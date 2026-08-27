import { withTenant } from '@worksyzo/db';
import { getObjectStorage } from '@worksyzo/storage';
import { chunkText } from './chunk';
import { extractTextFromBuffer } from './extract';
import { embedTexts, toVectorLiteral } from './llm';

export interface ProcessDocumentInput {
  orgId: string;
  documentId: string;
  /** System actor for tenant context (uploader or worker service user). */
  actorUserId: string;
}

/**
 * Full ingest: load bytes from configured storage (R2 or local) → extract →
 * chunk → embed → write chunks → mark ready/failed.
 */
export async function processDocument(input: ProcessDocumentInput): Promise<void> {
  const { orgId, documentId, actorUserId } = input;

  await withTenant({ orgId, userId: actorUserId }, async (client) => {
    await client.query(
      `UPDATE documents SET status = 'processing', error = NULL, updated_at = now()
       WHERE id = $1`,
      [documentId],
    );
  });

  try {
    const doc = await withTenant({ orgId, userId: actorUserId }, async (client) => {
      const row = await client.query<{
        id: string;
        storage_key: string;
        mime_type: string;
        title: string;
      }>(
        'SELECT id, storage_key, mime_type, title FROM documents WHERE id = $1 AND deleted_at IS NULL',
        [documentId],
      );
      return row.rows[0] ?? null;
    });

    if (!doc) throw new Error('Document not found');

    const storage = getObjectStorage();
    const buffer = await storage.get(doc.storage_key);
    const text = await extractTextFromBuffer(buffer, doc.mime_type, doc.title);
    if (!text || text.length < 20) {
      throw new Error('No readable text found in this file. Try a text-based PDF or DOCX.');
    }

    const chunks = chunkText(text);
    if (chunks.length === 0) throw new Error('Document produced zero chunks');

    const vectors: number[][] = [];
    let embedTokens = 0;
    const batchSize = 32;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const embedded = await embedTexts(batch.map((c) => c.content));
      vectors.push(...embedded.vectors);
      embedTokens += embedded.totalTokens;
    }

    await withTenant({ orgId, userId: actorUserId }, async (client) => {
      await client.query('DELETE FROM document_chunks WHERE document_id = $1', [documentId]);

      for (let i = 0; i < chunks.length; i += 1) {
        const chunk = chunks[i]!;
        const vector = vectors[i];
        if (!vector) throw new Error(`Missing embedding for chunk ${i}`);
        await client.query(
          `INSERT INTO document_chunks
             (org_id, document_id, chunk_index, content, token_count, embedding, metadata)
           VALUES ($1, $2, $3, $4, $5, $6::vector, $7::jsonb)`,
          [
            orgId,
            documentId,
            chunk.index,
            chunk.content,
            chunk.tokenCount,
            toVectorLiteral(vector),
            JSON.stringify({ title: doc.title }),
          ],
        );
      }

      await client.query(
        `UPDATE documents SET status = 'ready', error = NULL, updated_at = now() WHERE id = $1`,
        [documentId],
      );

      await client.query(
        `INSERT INTO ai_usage_daily (org_id, day, embed_tokens, request_count)
         VALUES ($1, CURRENT_DATE, $2, 0)
         ON CONFLICT (org_id, day) DO UPDATE
           SET embed_tokens = ai_usage_daily.embed_tokens + EXCLUDED.embed_tokens`,
        [orgId, embedTokens],
      );
    });
  } catch (error) {
    const message = (error as Error).message || 'Ingest failed';
    await withTenant({ orgId, userId: actorUserId }, async (client) => {
      await client.query(
        `UPDATE documents SET status = 'failed', error = $2, updated_at = now() WHERE id = $1`,
        [documentId, message.slice(0, 1000)],
      );
    }).catch(() => undefined);
    throw error;
  }
}

/** Claim and process one pending document. Returns true if work was done. */
export async function processNextPendingDocument(): Promise<boolean> {
  const { getAdminPool } = await import('@worksyzo/db');
  const pool = getAdminPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const row = await client.query<{
      id: string;
      org_id: string;
      uploaded_by: string;
    }>(
      `SELECT id, org_id, uploaded_by FROM documents
       WHERE status = 'pending' AND deleted_at IS NULL
       ORDER BY created_at ASC
       FOR UPDATE SKIP LOCKED
       LIMIT 1`,
    );
    const doc = row.rows[0];
    if (!doc) {
      await client.query('COMMIT');
      return false;
    }
    await client.query(
      `UPDATE documents SET status = 'processing', updated_at = now() WHERE id = $1`,
      [doc.id],
    );
    await client.query('COMMIT');

    await processDocument({
      orgId: doc.org_id,
      documentId: doc.id,
      actorUserId: doc.uploaded_by,
    });
    return true;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
