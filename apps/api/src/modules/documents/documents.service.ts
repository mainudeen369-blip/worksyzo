import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { isSupportedMime, processDocument } from '@worksyzo/ingest';
import { queryOne, queryRows, withTenant, type DocumentRow, type DocumentChunkRow } from '@worksyzo/db';
import { documentStorageKey, getObjectStorage } from '@worksyzo/storage';
import { AUDIT_ACTIONS, type DocumentView, type DocumentInspectView, type DocumentChunkView, type DocumentPipelineStage } from '@worksyzo/shared';
import { AuditService } from '../audit/audit.service';

const MAX_BYTES = 12 * 1024 * 1024;

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(@Inject(AuditService) private readonly audit: AuditService) {}

  async list(orgId: string, userId: string): Promise<DocumentView[]> {
    return withTenant({ orgId, userId }, async (client) => {
      const rows = await queryRows<DocumentRow>(
        client,
        `SELECT * FROM documents
         WHERE deleted_at IS NULL
         ORDER BY created_at DESC
         LIMIT 200`,
      );
      return rows.map(toView);
    });
  }

  async get(orgId: string, userId: string, documentId: string): Promise<DocumentView> {
    return withTenant({ orgId, userId }, async (client) => {
      const row = await queryOne<DocumentRow>(
        client,
        'SELECT * FROM documents WHERE id = $1 AND deleted_at IS NULL',
        [documentId],
      );
      if (!row) throw new NotFoundException('Document not found');
      return toView(row);
    });
  }

  async inspect(orgId: string, userId: string, documentId: string): Promise<DocumentInspectView> {
    return withTenant({ orgId, userId }, async (client) => {
      const docRow = await queryOne<DocumentRow>(
        client,
        'SELECT * FROM documents WHERE id = $1 AND deleted_at IS NULL',
        [documentId],
      );
      if (!docRow) throw new NotFoundException('Document not found');

      const chunkRows = await queryRows<DocumentChunkRow>(
        client,
        `SELECT id, org_id, document_id, chunk_index, content, token_count, embedding::text AS embedding_text, metadata, created_at
         FROM document_chunks
         WHERE document_id = $1
         ORDER BY chunk_index ASC`,
        [documentId],
      );

      const chunks: DocumentChunkView[] = chunkRows.map((row) => {
        let embeddingPreview: number[] = [];
        let embeddingDimensions = 1536;
        if (row.embedding_text) {
          try {
            const raw = row.embedding_text.replace(/[\[\]]/g, '').split(',');
            embeddingDimensions = raw.length;
            embeddingPreview = raw.slice(0, 12).map((v) => Number(parseFloat(v).toFixed(5)));
          } catch {
            // fallback
          }
        }
        return {
          id: row.id,
          chunkIndex: row.chunk_index,
          content: row.content,
          tokenCount: row.token_count,
          charCount: row.content.length,
          embeddingDimensions,
          embeddingPreview,
          createdAt: row.created_at.toISOString(),
        };
      });

      const totalChunks = chunks.length;
      const totalTokens = chunks.reduce((acc, c) => acc + c.tokenCount, 0);
      const totalCharacters = chunks.reduce((acc, c) => acc + c.charCount, 0);
      const averageTokensPerChunk = totalChunks > 0 ? Math.round(totalTokens / totalChunks) : 0;

      const isReady = docRow.status === 'ready';
      const isProcessing = docRow.status === 'processing';
      const isFailed = docRow.status === 'failed';

      const pipelineStages: DocumentPipelineStage[] = [
        {
          stage: 'extract',
          name: '1. Text & Stream Extraction',
          description: `Extracted raw text from binary format (${docRow.mime_type}) using specialized parser.`,
          status: isReady || isProcessing ? 'completed' : isFailed ? 'failed' : 'pending',
          details: totalCharacters > 0 ? `${totalCharacters.toLocaleString()} characters extracted` : undefined,
        },
        {
          stage: 'chunk',
          name: '2. Sliding-Window Semantic Chunking',
          description: 'Segmented text into ~600-token blocks with 80-token overlap to maintain semantic continuity across boundaries.',
          status: isReady ? 'completed' : isProcessing ? 'in_progress' : isFailed ? 'failed' : 'pending',
          details: totalChunks > 0 ? `${totalChunks} chunks generated (~${averageTokensPerChunk} avg tokens/chunk)` : undefined,
        },
        {
          stage: 'embed',
          name: '3. High-Dimensional Vectorization',
          description: 'Vectorized each text chunk into a 1536-dimensional semantic dense embedding vector.',
          status: isReady ? 'completed' : isProcessing ? 'in_progress' : isFailed ? 'failed' : 'pending',
          details: totalChunks > 0 ? `${totalChunks} vectors generated (1536 dims)` : undefined,
        },
        {
          stage: 'index',
          name: '4. PostgreSQL pgvector Storage & HNSW Indexing',
          description: 'Stored chunks in document_chunks with cosine distance (<->) vector index for instant RAG search.',
          status: isReady ? 'completed' : isProcessing ? 'in_progress' : isFailed ? 'failed' : 'pending',
          details: isReady ? 'Indexed & active for AI chat citations' : undefined,
        },
      ];

      return {
        document: toView(docRow),
        totalChunks,
        totalTokens,
        totalCharacters,
        averageTokensPerChunk,
        embeddingModel: 'text-embedding-3-small (1536 dims)',
        vectorDimensions: 1536,
        pipelineStages,
        chunks,
      };
    });
  }

  async upload(
    orgId: string,
    userId: string,
    file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
    title?: string,
  ): Promise<DocumentView> {
    if (!file?.buffer?.length) throw new BadRequestException('File is required');
    if (file.size > MAX_BYTES) {
      throw new BadRequestException('File exceeds the 12 MB limit');
    }
    if (!isSupportedMime(file.mimetype, file.originalname)) {
      throw new BadRequestException('Supported types: PDF, DOCX, XLSX, TXT, MD, CSV');
    }

    const docTitle = (title?.trim() || file.originalname).slice(0, 200);
    const storage = getObjectStorage();

    const created = await withTenant({ orgId, userId }, async (client) => {
      const row = await queryOne<DocumentRow>(
        client,
        `INSERT INTO documents
           (org_id, title, source_type, mime_type, storage_key, byte_size, status, visibility, uploaded_by)
         VALUES ($1, $2, 'upload', $3, 'pending', $4, 'pending', 'org', $5)
         RETURNING *`,
        [orgId, docTitle, file.mimetype || 'application/octet-stream', file.size, userId],
      );
      if (!row) throw new Error('Failed to create document');

      const storageKey = documentStorageKey(orgId, row.id, file.originalname);
      try {
        await storage.put(storageKey, file.buffer, file.mimetype);
      } catch (error) {
        const msg = (error as Error).message || 'Storage upload failed';
        throw new BadRequestException(
          `File storage (${storage.driver}) rejected the upload: ${msg}. ` +
            'Check R2_BUCKET name matches the bucket on the API token, and the token is Object Read & Write.',
        );
      }
      const updated = await queryOne<DocumentRow>(
        client,
        `UPDATE documents SET storage_key = $2, updated_at = now() WHERE id = $1 RETURNING *`,
        [row.id, storageKey],
      );
      return updated ?? row;
    });

    await this.audit.write({
      orgId,
      actorUserId: userId,
      action: AUDIT_ACTIONS.documentUploaded,
      resourceType: 'document',
      resourceId: created.id,
      metadata: {
        title: created.title,
        mimeType: created.mime_type,
        bytes: Number(created.byte_size),
        storageDriver: storage.driver,
      },
    });

    void this.enqueueIngest(orgId, created.id, userId);
    return toView(created);
  }

  async retry(orgId: string, userId: string, documentId: string): Promise<DocumentView> {
    const doc = await withTenant({ orgId, userId }, async (client) => {
      const row = await queryOne<DocumentRow>(
        client,
        `UPDATE documents
         SET status = 'pending', error = NULL, updated_at = now()
         WHERE id = $1 AND deleted_at IS NULL
         RETURNING *`,
        [documentId],
      );
      if (!row) throw new NotFoundException('Document not found');
      return row;
    });
    void this.enqueueIngest(orgId, doc.id, userId);
    return toView(doc);
  }

  async remove(orgId: string, userId: string, documentId: string): Promise<void> {
    const storageKey = await withTenant({ orgId, userId }, async (client) => {
      const row = await queryOne<DocumentRow>(
        client,
        `UPDATE documents
         SET deleted_at = now(), updated_at = now()
         WHERE id = $1 AND deleted_at IS NULL
         RETURNING *`,
        [documentId],
      );
      if (!row) throw new NotFoundException('Document not found');
      await client.query('DELETE FROM document_chunks WHERE document_id = $1', [documentId]);
      return row.storage_key;
    });

    await getObjectStorage().delete(storageKey);
    await this.audit.write({
      orgId,
      actorUserId: userId,
      action: AUDIT_ACTIONS.documentDeleted,
      resourceType: 'document',
      resourceId: documentId,
    });
  }

  private enqueueIngest(orgId: string, documentId: string, userId: string): void {
    setTimeout(() => {
      processDocument({ orgId, documentId, actorUserId: userId }).catch((error: Error) => {
        this.logger.warn(`Ingest failed for ${documentId}: ${error.message}`);
      });
    }, 10);
  }
}

function toView(row: DocumentRow): DocumentView {
  return {
    id: row.id,
    title: row.title,
    mimeType: row.mime_type,
    byteSize: Number(row.byte_size),
    status: row.status,
    error: row.error,
    visibility: row.visibility,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
