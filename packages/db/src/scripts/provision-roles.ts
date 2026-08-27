/**
 * Provisions the least-privilege runtime role on Neon (or any Postgres).
 *
 * Usage:
 *   1. Put your Neon owner connection string in DATABASE_ADMIN_URL in .env
 *   2. Optionally set WORKSYZO_APP_PASSWORD
 *   3. npm run db:provision
 *   4. Copy the printed DATABASE_URL into .env
 */
import { randomBytes } from 'node:crypto';
import { closePools, getAdminPool, optionalEnv } from '../index';

function replaceUrlCredentials(adminUrl: string, user: string, password: string): string {
  const url = new URL(adminUrl);
  url.username = encodeURIComponent(user);
  url.password = encodeURIComponent(password);
  // URL constructor decodes username/password setters differently across Node versions;
  // set via properties then ensure sslmode.
  url.username = user;
  url.password = password;
  if (!url.searchParams.has('sslmode')) {
    url.searchParams.set('sslmode', 'require');
  }
  return url.toString();
}

async function main(): Promise<void> {
  const password =
    optionalEnv('WORKSYZO_APP_PASSWORD', '') || randomBytes(18).toString('base64url');

  const pool = getAdminPool();
  const client = await pool.connect();

  try {
    console.log('Enabling extensions ...');
    await client.query('CREATE EXTENSION IF NOT EXISTS vector');
    await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
    await client.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');

    const dbName = (
      await client.query<{ current_database: string }>('SELECT current_database()')
    ).rows[0]!.current_database;

    console.log(`Creating role worksyzo_app on database "${dbName}" (NOBYPASSRLS) ...`);
    const exists = await client.query<{ exists: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'worksyzo_app') AS exists`,
    );

    if (!exists.rows[0]?.exists) {
      await client.query(`CREATE ROLE worksyzo_app LOGIN PASSWORD $1 NOBYPASSRLS`, [password]);
    } else {
      await client.query(`ALTER ROLE worksyzo_app WITH LOGIN PASSWORD $1 NOBYPASSRLS`, [password]);
      console.log('Role already existed — password updated.');
    }

    // Identifier quoting for database name
    const quotedDb = `"${dbName.replace(/"/g, '""')}"`;
    await client.query(`GRANT CONNECT ON DATABASE ${quotedDb} TO worksyzo_app`);
    await client.query('GRANT USAGE ON SCHEMA public TO worksyzo_app');
    await client.query(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO worksyzo_app',
    );
    await client.query('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO worksyzo_app');
    await client.query(`
      ALTER DEFAULT PRIVILEGES IN SCHEMA public
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO worksyzo_app
    `);
    await client.query(`
      ALTER DEFAULT PRIVILEGES IN SCHEMA public
        GRANT USAGE, SELECT ON SEQUENCES TO worksyzo_app
    `);

    const adminUrl = process.env.DATABASE_ADMIN_URL || process.env.DATABASE_URL;
    if (!adminUrl) {
      throw new Error('DATABASE_URL is missing in .env');
    }
    const appUrl = replaceUrlCredentials(adminUrl, 'worksyzo_app', password);

    console.log('\nOptional hardening (recommended later):');
    console.log('  Keep your Neon owner string as DATABASE_ADMIN_URL');
    console.log('  Set DATABASE_URL to the app role below\n');
    console.log(`DATABASE_ADMIN_URL=${adminUrl}`);
    console.log(`WORKSYZO_APP_PASSWORD=${password}`);
    console.log(`DATABASE_URL=${appUrl}`);
    console.log('\nFor now, a single DATABASE_URL (owner) is enough to migrate/seed/run.');
    console.log('Next:\n  npm run db:migrate\n  npm run db:seed\n');
  } finally {
    client.release();
    await closePools();
  }
}

main().catch((error: Error) => {
  console.error(`\nProvision failed: ${error.message}`);
  console.error(
    'Make sure DATABASE_ADMIN_URL in .env is your Neon owner connection string with ?sslmode=require',
  );
  process.exit(1);
});
