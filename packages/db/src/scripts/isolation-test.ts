/**
 * Tenant isolation proof.
 *
 * Connects with DATABASE_URL, then SET ROLE worksyzo_app so we exercise the
 * least-privilege path even when .env only has a single Neon owner URL.
 */
import { closePools, getAdminPool, getAppPool } from '../pool';
import { withTenant, withIdentity } from '../tenant';

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail = ''): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}${detail ? ` - ${detail}` : ''}`);
  }
}

async function expectRejection(name: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
    check(name, false, 'the operation was allowed but should have been blocked');
  } catch {
    check(name, true);
  }
}

/** Run fn as worksyzo_app inside a transaction (Neon-friendly single-URL setup). */
async function asAppRole<T>(fn: (client: import('pg').PoolClient) => Promise<T>): Promise<T> {
  const client = await getAppPool().connect();
  try {
    await client.query('BEGIN');
    // Owner can assume the app role; if already worksyzo_app this is a no-op path.
    await client.query('SET LOCAL ROLE worksyzo_app');
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

async function asAppTenant<T>(
  orgId: string,
  userId: string,
  fn: (client: import('pg').PoolClient) => Promise<T>,
): Promise<T> {
  return asAppRole(async (client) => {
    await client.query(
      "SELECT set_config('app.current_org_id', $1, true), set_config('app.current_user_id', $2, true)",
      [orgId, userId],
    );
    return fn(client);
  });
}

async function main(): Promise<void> {
  const admin = getAdminPool();

  // Ensure owner can become worksyzo_app
  await admin.query('GRANT worksyzo_app TO CURRENT_USER').catch(() => undefined);

  const orgs = await admin.query<{ id: string; name: string; slug: string }>(
    "SELECT id, name, slug FROM organizations WHERE slug IN ('acme-manufacturing', 'northwind-traders') ORDER BY slug",
  );
  if (orgs.rows.length < 2) {
    throw new Error('Run `npm run db:seed` first - the test needs both demo organizations.');
  }
  const acme = orgs.rows.find((o) => o.slug === 'acme-manufacturing')!;
  const northwind = orgs.rows.find((o) => o.slug === 'northwind-traders')!;

  const acmeOwner = await admin.query<{ user_id: string }>(
    "SELECT user_id FROM org_memberships WHERE org_id = $1 AND role = 'owner' LIMIT 1",
    [acme.id],
  );
  const actorId = acmeOwner.rows[0]!.user_id;

  console.log('\nTenant isolation checks\n');

  const roleRow = await asAppRole((c) =>
    c
      .query<{ current_user: string; rolbypassrls: boolean }>(
        `SELECT current_user,
                (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS rolbypassrls`,
      )
      .then((r) => r.rows[0]!),
  );
  check('session runs as worksyzo_app', roleRow.current_user === 'worksyzo_app', roleRow.current_user);
  check('worksyzo_app cannot bypass RLS', roleRow.rolbypassrls === false);

  const acmeMemories = await asAppTenant(acme.id, actorId, (c) =>
    c.query<{ title: string }>('SELECT title FROM memories').then((r) => r.rows),
  );
  check('tenant A sees its own memories', acmeMemories.length > 0, `${acmeMemories.length} rows`);
  check(
    'tenant A cannot see tenant B memories',
    !acmeMemories.some((m) => m.title.includes('Kochi Distributors')),
  );

  const crossReadById = await asAppTenant(acme.id, actorId, (c) =>
    c.query('SELECT id FROM memories WHERE org_id = $1', [northwind.id]).then((r) => r.rowCount ?? 0),
  );
  check('explicit cross-tenant WHERE returns nothing', crossReadById === 0, `${crossReadById} rows`);

  const noContext = await asAppRole((c) =>
    c.query('SELECT id FROM memories').then((r) => r.rowCount ?? 0),
  );
  check('missing tenant context returns zero rows (fail-closed)', noContext === 0, `${noContext} rows`);

  await expectRejection('writing into another tenant is rejected', () =>
    asAppTenant(acme.id, actorId, (c) =>
      c.query(
        `INSERT INTO memories (org_id, type, title, body, created_by)
         VALUES ($1, 'note', 'smuggled row', 'should never land', $2)`,
        [northwind.id, actorId],
      ),
    ),
  );

  await expectRejection('audit history cannot be edited at runtime', () =>
    asAppTenant(acme.id, actorId, (c) =>
      c.query("UPDATE audit_events SET action = 'tampered' WHERE org_id = $1", [acme.id]),
    ),
  );

  await expectRejection('audit history cannot be deleted at runtime', () =>
    asAppTenant(acme.id, actorId, (c) =>
      c.query('DELETE FROM audit_events WHERE org_id = $1', [acme.id]),
    ),
  );

  await expectRejection('plan limits are read-only at runtime', () =>
    asAppRole((c) => c.query("UPDATE usage_limits SET max_users = 9999 WHERE plan_code = 'starter'")),
  );

  await expectRejection('a task cannot be assigned to a non-member', () =>
    asAppTenant(acme.id, actorId, async (c) => {
      // Pull outsider id via admin outside this role... use known northwind member via admin first
      const outsider = await admin.query<{ user_id: string }>(
        'SELECT user_id FROM org_memberships WHERE org_id = $1 LIMIT 1',
        [northwind.id],
      );
      const outsiderId = outsider.rows[0]!.user_id;
      return c.query(
        `INSERT INTO tasks (org_id, title, assignee_user_id, created_by)
         VALUES ($1, 'cross-tenant assignment', $2, $3)`,
        [acme.id, outsiderId, actorId],
      );
    }),
  );

  const tenantTables = await admin.query<{ tablename: string }>(`
    SELECT c.relname AS tablename
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname = ANY(ARRAY[
        'teams', 'team_members',
        'documents', 'document_chunks', 'resource_grants',
        'memories', 'memory_chunks', 'memory_links',
        'projects', 'tasks', 'task_comments',
        'ai_conversations', 'ai_messages', 'ai_usage_daily',
        'audit_events', 'subscriptions'
      ])
      AND (c.relrowsecurity = false OR c.relforcerowsecurity = false)
  `);
  check(
    'tenant data-plane tables have FORCE row level security',
    tenantTables.rowCount === 0,
    tenantTables.rows.map((r) => r.tablename).join(', '),
  );

  // Keep unused imports honest if tree-shaken later
  void withTenant;
  void withIdentity;
  void getAppPool;

  console.log(`\n${passed} passed, ${failed} failed\n`);
  await closePools();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (error: Error) => {
  console.error(`\nIsolation test could not run: ${error.message}`);
  await closePools().catch(() => undefined);
  process.exit(1);
});
