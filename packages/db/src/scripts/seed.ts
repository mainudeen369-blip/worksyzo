import type { PoolClient } from 'pg';
import { slugify } from '@worksyzo/shared';
import { closePools, getAdminPool } from '../pool';
import { hashPassword } from '../security/password';

/**
 * Seeds two organizations on purpose. One is the demo tenant used for sales
 * walkthroughs; the second exists so that isolation is provable rather than
 * assumed (see isolation-test.ts).
 */

const DEMO_PASSWORD = 'worksyzo-demo-2026';

interface SeedUser {
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'manager' | 'member' | 'viewer';
}

interface SeedOrg {
  name: string;
  planCode: string;
  users: SeedUser[];
  memories: { type: 'decision' | 'note' | 'meeting'; title: string; body: string }[];
  projects: { name: string; description: string }[];
  tasks: { title: string; assignee: string; status: 'todo' | 'doing' | 'done'; dueInDays: number | null; project: string | null }[];
}

const ORGS: SeedOrg[] = [
  {
    name: 'Acme Manufacturing',
    planCode: 'business',
    users: [
      { email: 'owner@acme.test', name: 'Ravi Kumar', role: 'owner' },
      { email: 'hr@acme.test', name: 'Priya Nair', role: 'admin' },
      { email: 'ops@acme.test', name: 'Ahmed Sheikh', role: 'manager' },
      { email: 'staff@acme.test', name: 'Divya Menon', role: 'member' },
      { email: 'audit@acme.test', name: 'External Auditor', role: 'viewer' },
    ],
    memories: [
      {
        type: 'decision',
        title: 'Annual day scheduled for 12 December',
        body: 'Leadership agreed to hold the annual day on 12 December at the main auditorium. Ahmed Sheikh owns the auditorium arrangements and vendor coordination. Budget ceiling is INR 3,50,000 and Finance must approve anything above it.',
      },
      {
        type: 'meeting',
        title: 'Ops review - week 34',
        body: 'Line 2 downtime traced to the compressor. Preventive maintenance moves to a fortnightly cycle. Priya to publish the revised shift roster before Friday.',
      },
      {
        type: 'note',
        title: 'Leave policy clarification',
        body: 'Casual leave does not carry forward across the calendar year. Earned leave carries forward up to 30 days. Approvals go through the reporting manager, then HR.',
      },
    ],
    projects: [
      { name: 'Annual Day 2026', description: 'Planning and execution of the December annual day.' },
      { name: 'Line 2 Reliability', description: 'Reduce unplanned downtime on production line 2.' },
    ],
    tasks: [
      { title: 'Confirm auditorium booking', assignee: 'ops@acme.test', status: 'doing', dueInDays: 5, project: 'Annual Day 2026' },
      { title: 'Publish revised shift roster', assignee: 'hr@acme.test', status: 'todo', dueInDays: 2, project: null },
      { title: 'Order compressor spare parts', assignee: 'ops@acme.test', status: 'todo', dueInDays: 10, project: 'Line 2 Reliability' },
      { title: 'Circulate leave policy update', assignee: 'staff@acme.test', status: 'done', dueInDays: -3, project: null },
    ],
  },
  {
    name: 'Northwind Traders',
    planCode: 'starter',
    users: [
      { email: 'owner@northwind.test', name: 'Sana Iqbal', role: 'owner' },
      { email: 'staff@northwind.test', name: 'Vikram Rao', role: 'member' },
    ],
    memories: [
      {
        type: 'decision',
        title: 'Supplier switched to Kochi Distributors',
        body: 'Northwind moved primary supply to Kochi Distributors from Q3 after a 9 percent landed-cost reduction. This information must never appear in another tenant.',
      },
    ],
    projects: [{ name: 'Q4 Supplier Migration', description: 'Move remaining SKUs to the new supplier.' }],
    tasks: [
      { title: 'Renegotiate freight terms', assignee: 'staff@northwind.test', status: 'todo', dueInDays: 7, project: 'Q4 Supplier Migration' },
    ],
  },
];

async function upsertUser(
  client: PoolClient,
  email: string,
  name: string,
  passwordHash: string,
): Promise<string> {
  const existing = await client.query<{ id: string }>(
    'SELECT id FROM users WHERE lower(email) = lower($1)',
    [email],
  );
  if (existing.rows[0]) {
    await client.query(
      'UPDATE users SET name = $2, password_hash = $3, updated_at = now() WHERE id = $1',
      [existing.rows[0].id, name, passwordHash],
    );
    return existing.rows[0].id;
  }
  const row = await client.query<{ id: string }>(
    `INSERT INTO users (email, name, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [email, name, passwordHash],
  );
  return row.rows[0]!.id;
}

async function seedOrg(client: PoolClient, org: SeedOrg, passwordHash: string): Promise<void> {
  const slug = slugify(org.name);

  const orgRow = await client.query<{ id: string }>(
    `INSERT INTO organizations (name, slug, plan_code, status)
     VALUES ($1, $2, $3, 'active')
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, plan_code = EXCLUDED.plan_code
     RETURNING id`,
    [org.name, slug, org.planCode],
  );
  const orgId = orgRow.rows[0]!.id;

  await client.query(
    `INSERT INTO subscriptions (org_id, plan_code, status, trial_ends_at, current_period_end)
     VALUES ($1, $2, 'active', NULL, now() + interval '30 days')
     ON CONFLICT (org_id) DO UPDATE SET plan_code = EXCLUDED.plan_code`,
    [orgId, org.planCode],
  );

  const userIds = new Map<string, string>();
  for (const user of org.users) {
    const userId = await upsertUser(client, user.email, user.name, passwordHash);
    userIds.set(user.email, userId);
    await client.query(
      `INSERT INTO org_memberships (org_id, user_id, role, status, joined_at)
       VALUES ($1, $2, $3, 'active', now())
       ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = 'active'`,
      [orgId, userId, user.role],
    );
  }

  const ownerId = userIds.get(org.users[0]!.email)!;

  for (const memory of org.memories) {
    await client.query(
      `INSERT INTO memories (org_id, type, title, body, occurred_at, created_by)
       SELECT $1, $2, $3, $4, now(), $5
       WHERE NOT EXISTS (SELECT 1 FROM memories WHERE org_id = $1 AND title = $3)`,
      [orgId, memory.type, memory.title, memory.body, ownerId],
    );
  }

  const projectIds = new Map<string, string>();
  for (const project of org.projects) {
    const existing = await client.query<{ id: string }>(
      'SELECT id FROM projects WHERE org_id = $1 AND name = $2',
      [orgId, project.name],
    );
    if (existing.rows[0]) {
      projectIds.set(project.name, existing.rows[0].id);
      continue;
    }
    const created = await client.query<{ id: string }>(
      `INSERT INTO projects (org_id, name, description, owner_user_id)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [orgId, project.name, project.description, ownerId],
    );
    projectIds.set(project.name, created.rows[0]!.id);
  }

  for (const task of org.tasks) {
    const assigneeId = userIds.get(task.assignee) ?? null;
    const projectId = task.project ? projectIds.get(task.project) ?? null : null;
    await client.query(
      `INSERT INTO tasks (org_id, project_id, title, status, assignee_user_id, due_at, created_by, source, completed_at)
       SELECT $1, $2, $3, $4, $5,
              CASE WHEN $6::int IS NULL THEN NULL ELSE now() + ($6::int || ' days')::interval END,
              $7, 'ui',
              CASE WHEN $4 = 'done' THEN now() ELSE NULL END
       WHERE NOT EXISTS (SELECT 1 FROM tasks WHERE org_id = $1 AND title = $3)`,
      [orgId, projectId, task.title, task.status, assigneeId, task.dueInDays, ownerId],
    );
  }

  await client.query(
    `INSERT INTO audit_events (org_id, actor_user_id, action, resource_type, resource_id, metadata)
     VALUES ($1, $2, 'org.created', 'organization', $1, jsonb_build_object('seed', true))`,
    [orgId, ownerId],
  );

  console.log(`  ${org.name} (${slug}) seeded with ${org.users.length} users`);
}

async function main(): Promise<void> {
  const client = await getAdminPool().connect();
  try {
    console.log('Hashing demo password ...');
    const passwordHash = await hashPassword(DEMO_PASSWORD);

    await client.query('BEGIN');
    for (const org of ORGS) {
      await seedOrg(client, org, passwordHash);
    }
    await client.query('COMMIT');

    console.log('\nSeed complete. Sign in with any of:');
    for (const org of ORGS) {
      for (const user of org.users) {
        console.log(`  ${user.email.padEnd(28)} ${user.role.padEnd(8)} ${org.name}`);
      }
    }
    console.log(`\nPassword for every demo account: ${DEMO_PASSWORD}`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await closePools();
  }
}

main().catch((error: Error) => {
  console.error(`\nSeed failed: ${error.message}`);
  process.exit(1);
});
