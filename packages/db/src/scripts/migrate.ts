import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { closePools, getAdminPool } from '../pool';

const MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations');

async function main(): Promise<void> {
  const pool = getAdminPool();
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   text PRIMARY KEY,
        checksum   text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const applied = new Map<string, string>(
      (await client.query<{ filename: string; checksum: string }>(
        'SELECT filename, checksum FROM schema_migrations',
      )).rows.map((r) => [r.filename, r.checksum]),
    );

    let ran = 0;
    for (const file of files) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const previous = applied.get(file);

      if (previous) {
        if (previous !== checksum) {
          throw new Error(
            `Migration ${file} changed after it was applied. Applied migrations are immutable - add a new file instead.`,
          );
        }
        continue;
      }

      process.stdout.write(`  applying ${file} ... `);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)',
          [file, checksum],
        );
        await client.query('COMMIT');
        process.stdout.write('ok\n');
        ran += 1;
      } catch (error) {
        await client.query('ROLLBACK');
        process.stdout.write('failed\n');
        throw error;
      }
    }

    console.log(ran === 0 ? 'Database already up to date.' : `Applied ${ran} migration(s).`);
  } finally {
    client.release();
    await closePools();
  }
}

main().catch((error: Error) => {
  console.error(`\nMigration failed: ${error.message}`);
  process.exit(1);
});
