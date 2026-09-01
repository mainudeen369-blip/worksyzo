import dotenv from 'dotenv';
dotenv.config();

import { getAdminPool, withTenant, closePools } from '../packages/db/dist/index.js';
import { processDocument, embedTexts, toVectorLiteral, chatCompletion } from '../packages/ingest/dist/index.js';

async function runAiServiceQuery({ orgId, userId, orgName, role, message }) {
  return withTenant({ orgId, userId }, async (client) => {
    console.log(`\n================================================================================`);
    console.log(`QUESTION: "${message}"`);
    console.log(`================================================================================`);

    const embedded = await embedTexts([message]);
    const queryVector = embedded.vectors[0];
    if (!queryVector) {
      throw new Error('Could not embed question');
    }

    // Exact AiService Multi-Strategy Retrieval Logic
    const rawTokens = message
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1);

    const stopwords = new Set([
      'the', 'and', 'for', 'about', 'this', 'give', 'what', 'brief', 'show',
      'tell', 'please', 'can', 'you', 'with', 'from', 'that', 'have', 'has',
      'is', 'are', 'was', 'were', 'our', 'all', 'any', 'how', 'who', 'when',
      'where', 'why', 'which', 'summarize', 'summary'
    ]);

    const keywords = rawTokens.filter((w) => !stopwords.has(w) && w.length >= 2);
    const keywordRegex = keywords.length > 0 
      ? `(${keywords.map((k) => k.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|')})` 
      : null;

    console.log(`[Retrieval] Parsed keywords:`, keywords);
    console.log(`[Retrieval] Keyword Regex:`, keywordRegex);

    const hits = await client.query(
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
         ORDER BY dc.embedding <=> $1::vector
         LIMIT 8
       ),
       keyword_hits AS (
         SELECT dc.document_id, d.title, dc.chunk_index, dc.content,
                0.05 AS distance,
                1 AS priority
         FROM document_chunks dc
         JOIN documents d ON d.id = dc.document_id AND d.org_id = dc.org_id
         WHERE d.deleted_at IS NULL
           AND d.status = 'ready'
           AND d.visibility = 'org'
           AND ($2::text IS NOT NULL AND (d.title ~* $2 OR dc.content ~* $2))
         LIMIT 6
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
         ORDER BY d.created_at DESC, dc.chunk_index ASC
         LIMIT 4
       )
       SELECT DISTINCT ON (document_id, chunk_index)
              document_id, title, chunk_index, content, distance, priority
       FROM (
         SELECT * FROM keyword_hits
         UNION ALL
         SELECT * FROM vector_hits
         UNION ALL
         SELECT * FROM recent_hits
       ) combined
       ORDER BY document_id, chunk_index, priority ASC, distance ASC
       LIMIT 8`,
      [toVectorLiteral(queryVector), keywordRegex],
    );

    const citations = hits.rows.map((row) => ({
      documentId: row.document_id,
      title: row.title,
      chunkIndex: row.chunk_index,
      excerpt: row.content.slice(0, 400),
      score: Number(row.distance),
      priority: row.priority,
    }));

    console.log(`\n--- RETRIEVED CITATIONS (${citations.length} total) ---`);
    citations.forEach((c, i) => {
      console.log(`\n[Citation #${i + 1}] Title: "${c.title}" | Chunk: ${c.chunkIndex} | Priority: ${c.priority} | Distance/Score: ${c.score}`);
      console.log(`Excerpt: ${c.excerpt.replace(/\n/g, ' ')}...`);
    });

    const contextBlock =
      citations.length === 0
        ? 'No organization documents matched this question.'
        : citations
            .map(
              (c, i) =>
                `[#${i + 1}] ${c.title} (chunk ${c.chunkIndex})\n${c.excerpt}`,
            )
            .join('\n\n');

    console.log(`\n--- CONTEXT RETRIEVED (passed to LLM) ---`);
    console.log(contextBlock);

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
          content: `Organization context:\n\n${contextBlock}\n\nQuestion: ${message}`,
        },
      ],
      citations.map((c) => ({ title: c.title, excerpt: c.excerpt, chunkIndex: c.chunkIndex })),
    );

    console.log(`\n--- ANSWER (Model: ${completion.model}, Tokens: ${completion.promptTokens} in / ${completion.completionTokens} out) ---`);
    console.log(completion.content);
    console.log(`--------------------------------------------------------------------------------\n`);

    return {
      citations,
      contextBlock,
      completion,
    };
  });
}

async function main() {
  const pool = getAdminPool();

  console.log('>>> Step 1: Locating BBVA_Factsheet.pdf in the DB...');
  const docRes = await pool.query(
    `SELECT d.id, d.org_id, d.uploaded_by, d.title, d.status, d.mime_type, d.storage_key,
            o.name as org_name, m.role as user_role
     FROM documents d
     JOIN organizations o ON o.id = d.org_id
     LEFT JOIN org_memberships m ON m.org_id = d.org_id AND m.user_id = d.uploaded_by
     WHERE d.title ILIKE '%BBVA_Factsheet.pdf%' AND d.deleted_at IS NULL
     LIMIT 1`
  );

  if (docRes.rows.length === 0) {
    throw new Error('BBVA_Factsheet.pdf not found in documents table!');
  }

  const doc = docRes.rows[0];
  console.log(`Found Document:`, {
    id: doc.id,
    title: doc.title,
    orgId: doc.org_id,
    orgName: doc.org_name,
    uploadedBy: doc.uploaded_by,
    userRole: doc.user_role,
    status: doc.status,
    storageKey: doc.storage_key,
  });

  console.log(`\n>>> Step 2: Re-running processDocument for BBVA_Factsheet.pdf...`);
  await processDocument({
    orgId: doc.org_id,
    documentId: doc.id,
    actorUserId: doc.uploaded_by,
  });
  console.log(`[Success] processDocument completed successfully for ${doc.title}!`);

  // Verify chunks in DB
  const chunksRes = await pool.query(
    `SELECT chunk_index, token_count, substring(content from 1 for 120) as preview,
            (embedding IS NOT NULL) as has_embedding
     FROM document_chunks
     WHERE document_id = $1
     ORDER BY chunk_index ASC`,
    [doc.id]
  );
  console.log(`\n[DB Verification] Total Chunks Generated: ${chunksRes.rows.length}`);
  chunksRes.rows.forEach((ch) => {
    console.log(`  Chunk ${ch.chunk_index} (${ch.token_count} tokens, embedding=${ch.has_embedding}): "${ch.preview.replace(/\n/g, ' ')}..."`);
  });

  console.log(`\n>>> Step 3: Testing Questions with exact AiService logic...`);

  // Test Question 1
  await runAiServiceQuery({
    orgId: doc.org_id,
    userId: doc.uploaded_by,
    orgName: doc.org_name,
    role: doc.user_role || 'owner',
    message: 'what is the latest updated doc',
  });

  // Test Question 2
  await runAiServiceQuery({
    orgId: doc.org_id,
    userId: doc.uploaded_by,
    orgName: doc.org_name,
    role: doc.user_role || 'owner',
    message: 'summarize BBVA_Factsheet.pdf',
  });

  await closePools();
  console.log('>>> All steps completed successfully!');
}

main().catch(async (err) => {
  console.error('Fatal error:', err);
  await closePools().catch(() => {});
  process.exit(1);
});
