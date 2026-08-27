import type { PoolClient } from 'pg';
import { getAppPool } from './pool';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface TenantContext {
  orgId: string;
  userId: string;
}

/**
 * Runs `fn` inside a transaction bound to one organization.
 *
 * `set_config(..., true)` is transaction-local, so the tenant scope cannot
 * leak to the next borrower of this pooled connection. Parameter binding is
 * used instead of a literal `SET LOCAL` because SET does not accept binds.
 */
export async function withTenant<T>(
  ctx: TenantContext,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  if (!UUID_RE.test(ctx.orgId)) {
    throw new Error('withTenant requires a valid organization id');
  }
  const client = await getAppPool().connect();
  try {
    await client.query('BEGIN');
    await client.query(
      "SELECT set_config('app.current_org_id', $1, true), set_config('app.current_user_id', $2, true)",
      [ctx.orgId, ctx.userId],
    );
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Identity-plane access (users, sessions, memberships) for work that happens
 * before an organization is known: login, invite acceptance, org listing.
 * These tables carry no org_id, so callers MUST scope by user_id themselves.
 */
export async function withIdentity<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getAppPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

/** Identity-plane work that must be atomic (registration, invite acceptance). */
export async function withIdentityTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getAppPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Bootstrap case: creating an organization and its first rows in one
 * transaction, where the tenant context must exist for RLS to accept the
 * inserts but the caller's membership is being created in the same unit.
 */
export async function withNewTenantTransaction<T>(
  orgId: string,
  userId: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getAppPool().connect();
  try {
    await client.query('BEGIN');
    await client.query(
      "SELECT set_config('app.current_org_id', $1, true), set_config('app.current_user_id', $2, true)",
      [orgId, userId],
    );
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
