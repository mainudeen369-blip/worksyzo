export interface ObjectStorage {
  readonly driver: 'local' | 'r2';
  /** Human-readable description for health / setup UI. */
  describe(): string;
  put(key: string, body: Buffer, contentType?: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

export function documentStorageKey(orgId: string, documentId: string, fileName: string): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120);
  return ['orgs', orgId, 'documents', documentId, safe].join('/');
}
