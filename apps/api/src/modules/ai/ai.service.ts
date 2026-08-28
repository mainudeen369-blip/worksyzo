import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { chatCompletion, embedTexts, toVectorLiteral } from '@worksyzo/ingest';
import { queryOne, withTenant } from '@worksyzo/db';
import {
  AUDIT_ACTIONS,
  type ChatInput,
  type ChatResponseView,
  type CitationView,
} from '@worksyzo/shared';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AiService {
  constructor(@Inject(AuditService) private readonly audit: AuditService) {}

  async chat(
    orgId: string,
    userId: string,
    orgName: string,
    role: string,
    input: ChatInput,
  ): Promise<ChatResponseView> {
    return withTenant({ orgId, userId }, async (client) => {
      let conversationId = input.conversationId;
      if (conversationId) {
        const existing = await queryOne<{ id: string }>(
          client,
          'SELECT id FROM ai_conversations WHERE id = $1 AND user_id = $2',
          [conversationId, userId],
        );
        if (!existing) conversationId = undefined;
      }

      if (!conversationId) {
        const title = input.message.slice(0, 80);
        const created = await queryOne<{ id: string }>(
          client,
          `INSERT INTO ai_conversations (org_id, user_id, title)
           VALUES ($1, $2, $3) RETURNING id`,
          [orgId, userId, title],
        );
        conversationId = created!.id;
      }

      await client.query(
        `INSERT INTO ai_messages (org_id, conversation_id, role, content)
         VALUES ($1, $2, 'user', $3)`,
        [orgId, conversationId, input.message],
      );

      const embedded = await embedTexts([input.message]);
      const queryVector = embedded.vectors[0];
      if (!queryVector) throw new BadRequestException('Could not embed question');

      // Multi-Strategy Retrieval:
      // 1. Vector Cosine Similarity Search
      // 2. Keyword & Title Trigram / ILIKE Match for targeted document questions (e.g. "BBVA Factsheet", "leave policy")
      const keywords = input.message
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2 && !['the', 'and', 'for', 'about', 'this', 'give', 'what', 'brief', 'show', 'tell'].includes(w));
      
      const keywordPattern = keywords.length > 0 ? `%(${keywords.join('|')})%` : '%';

      const hits = await client.query<{
        document_id: string;
        title: string;
        chunk_index: number;
        content: string;
        distance: number;
      }>(
        `WITH vector_hits AS (
           SELECT dc.document_id, d.title, dc.chunk_index, dc.content,
                  (dc.embedding <=> $1::vector) AS distance,
                  1 AS priority
           FROM document_chunks dc
           JOIN documents d ON d.id = dc.document_id AND d.org_id = dc.org_id
           WHERE d.deleted_at IS NULL
             AND d.status = 'ready'
             AND d.visibility = 'org'
             AND dc.embedding IS NOT NULL
           ORDER BY dc.embedding <=> $1::vector
           LIMIT 8
         ),
         keyword_hits AS (
           SELECT dc.document_id, d.title, dc.chunk_index, dc.content,
                  0.1 AS distance,
                  0 AS priority
           FROM document_chunks dc
           JOIN documents d ON d.id = dc.document_id AND d.org_id = dc.org_id
           WHERE d.deleted_at IS NULL
             AND d.status = 'ready'
             AND d.visibility = 'org'
             AND (d.title ~* $2 OR dc.content ~* $2)
           LIMIT 4
         )
         SELECT DISTINCT ON (document_id, chunk_index)
                document_id, title, chunk_index, content, distance
         FROM (
           SELECT * FROM keyword_hits
           UNION ALL
           SELECT * FROM vector_hits
         ) combined
         ORDER BY document_id, chunk_index, priority ASC, distance ASC
         LIMIT 8`,
        [toVectorLiteral(queryVector), keywordPattern],
      );

      const citations: CitationView[] = hits.rows.map((row) => ({
        documentId: row.document_id,
        title: row.title,
        chunkIndex: row.chunk_index,
        excerpt: row.content.slice(0, 400),
        score: Number(row.distance),
      }));

      const contextBlock =
        citations.length === 0
          ? 'No organization documents matched this question.'
          : citations
              .map(
                (c, i) =>
                  `[#${i + 1}] ${c.title} (chunk ${c.chunkIndex})\n${c.excerpt}`,
              )
              .join('\n\n');

      const completion = await chatCompletion(
        [
          {
            role: 'system',
            content: [
              `You are Worksyzo, the intelligent executive AI assistant for "${orgName}".`,
              `The current user role is "${role}".`,
              'Formatting & Tone Instructions:',
              '• Format responses with the highest professional clarity, like ChatGPT / Claude.',
              '• Always start with a concise, direct executive answer or summary paragraph.',
              '• Use structured markdown: use clear section headers (### or ####) and clean bullet points (•) with bold keywords for every key point, policy rule, step, or metric.',
              '• Avoid walls of dense text. Break down explanations into readable bulleted items.',
              '• Cite sources inline like [#1], [#2] directly after the relevant statements or facts.',
              '• If the organization context is empty or does not contain the answer, politely state what is missing and advise uploading the relevant document.',
              '• Strict Accuracy: Answer strictly from the provided organization context. Never invent policies or extrapolate unsupported data.',
            ].join('\n'),
          },
          {
            role: 'user',
            content: `Organization context:\n\n${contextBlock}\n\nQuestion: ${input.message}`,
          },
        ],
        citations.map((c) => ({ title: c.title, excerpt: c.excerpt, chunkIndex: c.chunkIndex })),
      );

      const assistant = await queryOne<{ id: string }>(
        client,
        `INSERT INTO ai_messages
           (org_id, conversation_id, role, content, citations, token_prompt, token_completion)
         VALUES ($1, $2, 'assistant', $3, $4::jsonb, $5, $6)
         RETURNING id`,
        [
          orgId,
          conversationId,
          completion.content,
          JSON.stringify(citations),
          completion.promptTokens,
          completion.completionTokens,
        ],
      );

      await client.query(
        `UPDATE ai_conversations SET updated_at = now() WHERE id = $1`,
        [conversationId],
      );

      await client.query(
        `INSERT INTO ai_usage_daily
           (org_id, day, request_count, prompt_tokens, completion_tokens, embed_tokens)
         VALUES ($1, CURRENT_DATE, 1, $2, $3, $4)
         ON CONFLICT (org_id, day) DO UPDATE SET
           request_count = ai_usage_daily.request_count + 1,
           prompt_tokens = ai_usage_daily.prompt_tokens + EXCLUDED.prompt_tokens,
           completion_tokens = ai_usage_daily.completion_tokens + EXCLUDED.completion_tokens,
           embed_tokens = ai_usage_daily.embed_tokens + EXCLUDED.embed_tokens`,
        [orgId, completion.promptTokens, completion.completionTokens, embedded.totalTokens],
      );

      await this.audit.write({
        client,
        orgId,
        actorUserId: userId,
        action: AUDIT_ACTIONS.aiChat,
        resourceType: 'ai_conversation',
        resourceId: conversationId,
        metadata: { citations: citations.length },
      });

      return {
        conversationId: conversationId!,
        messageId: assistant!.id,
        answer: completion.content,
        citations,
      };
    });
  }
}
