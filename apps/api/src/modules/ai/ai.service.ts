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
    // 2. Keyword & Title Trigram / Regex Match for targeted document questions (e.g. "BBVA Factsheet", "leave policy")
    // 3. Document recency fallback when asking for latest/recent documents
    const rawTokens = input.message
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1);

    const stopwords = new Set([
      'the', 'and', 'for', 'about', 'this', 'give', 'what', 'brief', 'show',
      'tell', 'please', 'can', 'you', 'with', 'from', 'that', 'have', 'has',
      'is', 'are', 'was', 'were', 'our', 'all', 'any', 'how', 'who', 'when',
      'where', 'why', 'which', 'summarize', 'summary', 'explain', 'describe',
      'me', 'my', 'one', 'doc', 'document', 'file', 'pdf',
    ]);

    const keywords = rawTokens.filter((w) => !stopwords.has(w) && w.length >= 3);
    const wantsRecent = /\b(latest|recent|newest|last uploaded|most recent)\b/i.test(
      input.message,
    );

    // Prefer a single document when the question matches a title (e.g. "Deep Technical Architecture")
    const titleScores = await client.query<{ id: string; title: string; score: number }>(
      `SELECT d.id, d.title,
              (SELECT COUNT(*)::int FROM unnest($1::text[]) kw
               WHERE d.title ILIKE '%' || kw || '%') AS score
       FROM documents d
       WHERE d.deleted_at IS NULL
         AND d.status = 'ready'
         AND d.visibility = 'org'
       ORDER BY score DESC, d.created_at DESC
       LIMIT 5`,
      [keywords.length > 0 ? keywords : ['__none__']],
    );

    let focusDocumentId: string | null = null;
    const bestTitle = titleScores.rows[0];
    if (bestTitle && bestTitle.score >= 2) {
      focusDocumentId = bestTitle.id;
    } else if (bestTitle?.score === 1) {
      const matched = titleScores.rows.filter((r) => r.score >= 1);
      if (matched.length === 1) focusDocumentId = matched[0]!.id;
    }

    const titleKeywordRegex =
      keywords.length > 0
        ? `(${keywords.map((k) => k.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|')})`
        : null;

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
                2 AS priority
         FROM document_chunks dc
         JOIN documents d ON d.id = dc.document_id AND d.org_id = dc.org_id
         WHERE d.deleted_at IS NULL
           AND d.status = 'ready'
           AND d.visibility = 'org'
           AND dc.embedding IS NOT NULL
           AND ($3::uuid IS NULL OR d.id = $3::uuid)
         ORDER BY dc.embedding <=> $1::vector
         LIMIT 8
       ),
       title_hits AS (
         SELECT dc.document_id, d.title, dc.chunk_index, dc.content,
                0.04 AS distance,
                1 AS priority
         FROM document_chunks dc
         JOIN documents d ON d.id = dc.document_id AND d.org_id = dc.org_id
         WHERE d.deleted_at IS NULL
           AND d.status = 'ready'
           AND d.visibility = 'org'
           AND ($3::uuid IS NULL OR d.id = $3::uuid)
           AND ($2::text IS NOT NULL AND d.title ~* $2)
         ORDER BY dc.chunk_index ASC
         LIMIT 8
       ),
       recent_hits AS (
         SELECT dc.document_id, d.title, dc.chunk_index, dc.content,
                0.15 AS distance,
                3 AS priority
         FROM document_chunks dc
         JOIN documents d ON d.id = dc.document_id AND d.org_id = dc.org_id
         WHERE d.deleted_at IS NULL
           AND d.status = 'ready'
           AND d.visibility = 'org'
           AND $4::boolean = true
         ORDER BY d.created_at DESC, dc.chunk_index ASC
         LIMIT 4
       )
       SELECT DISTINCT ON (document_id, chunk_index)
              document_id, title, chunk_index, content, distance, priority
       FROM (
         SELECT * FROM title_hits
         UNION ALL
         SELECT * FROM vector_hits
         UNION ALL
         SELECT * FROM recent_hits
       ) combined
       ORDER BY document_id, chunk_index, priority ASC, distance ASC
       LIMIT 8`,
      [toVectorLiteral(queryVector), titleKeywordRegex, focusDocumentId, wantsRecent],
    );

    // If results skew to one document, drop unrelated chunks
    let rows = hits.rows;
    if (!focusDocumentId && rows.length > 0) {
      const counts = new Map<string, number>();
      for (const row of rows) {
        counts.set(row.document_id, (counts.get(row.document_id) ?? 0) + 1);
      }
      const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
      if (dominant && dominant[1] >= Math.ceil(rows.length * 0.6)) {
        rows = rows.filter((r) => r.document_id === dominant[0]);
      }
    }

      const citations: CitationView[] = rows.map((row) => ({
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
              '• Answer from the most relevant document only — never mix unrelated documents in one response.',
              '• Synthesize a clean executive summary; do not dump raw document excerpts or unrelated snippets.',
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
