import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { dbEnv } from './env';

let appPool: Pool | null = null;
let adminPool: Pool | null = null;

/**
 * Runtime pool. Connects as worksyzo_app, which cannot bypass RLS.
 * Every tenant query must go through `withTenant`.
 */
export function getAppPool(): Pool {
  if (!appPool) {
    appPool = new Pool({
      connectionString: dbEnv.appUrl,
      max: Number(process.env.DB_POOL_MAX ?? 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      application_name: 'worksyzo-app',
    });
    appPool.on('error', (err) => {
      // eslint-disable-next-line no-console
      console.error('[db] idle client error', err.message);
    });
  }
  return appPool;
}

/** Owner pool for migrations and seeding only. Never use it to serve requests. */
export function getAdminPool(): Pool {
  if (!adminPool) {
    adminPool = new Pool({
      connectionString: dbEnv.adminUrl,
      max: 4,
      application_name: 'worksyzo-admin',
    });
  }
  return adminPool;
}

export async function closePools(): Promise<void> {
  await Promise.all([appPool?.end(), adminPool?.end()]);
  appPool = null;
  adminPool = null;
}

export type Queryable = Pool | PoolClient;

export async function queryRows<T extends QueryResultRow>(
  client: Queryable,
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await client.query<T>(text, params as never[]);
  return result.rows;
}

export async function queryOne<T extends QueryResultRow>(
  client: Queryable,
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await queryRows<T>(client, text, params);
  return rows[0] ?? null;
}
