# File storage setup (Cloudflare R2 primary, local path fallback)

Worksyzo never stores document **bytes** in Postgres. Postgres holds metadata +
embeddings only. Bytes go to object storage.

## Drivers

| `STORAGE_DRIVER` | Use when | Config |
|------------------|----------|--------|
| `r2` | Production / Render / real customers | Cloudflare R2 credentials |
| `local` | Laptop / air-gapped / temporary | `STORAGE_LOCAL_DIR` path |

## Option A — Cloudflare R2 (recommended)

1. Cloudflare dashboard → **R2** → Create bucket (e.g. `worksyzo-docs`)
2. **Manage R2 API Tokens** → Create API token with Object Read & Write
3. Copy Account ID, Access Key ID, Secret Access Key
4. In `.env`:

```env
STORAGE_DRIVER=r2
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=worksyzo-docs
```

5. Restart API + worker. `GET /health` should show `"driver":"r2"`.

Object keys look like:

```text
orgs/{orgId}/documents/{documentId}/{filename}
```

## Option B — Local disk (configurable path)

```env
STORAGE_DRIVER=local
STORAGE_LOCAL_DIR=D:\WorksyzoData\storage
```

Use an absolute path so it does not depend on the process working directory.
Relative paths (default `./.data/storage`) resolve from where you start the API.

## Switching later

You can flip `STORAGE_DRIVER` without a code change. Existing objects stay in the
old backend — migrate by re-uploading, or run a one-off copy job later.
