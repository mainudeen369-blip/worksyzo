import { execSync } from 'node:child_process';

const DEADLINE_MS = 90_000;
const started = Date.now();

process.stdout.write('Waiting for Postgres');

while (Date.now() - started < DEADLINE_MS) {
  try {
    execSync('docker exec worksyzo-postgres pg_isready -U postgres -d worksyzo', {
      stdio: 'ignore',
    });
    process.stdout.write(' ready\n');
    process.exit(0);
  } catch {
    process.stdout.write('.');
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

process.stdout.write('\nPostgres did not become ready in time. Check: docker compose logs postgres\n');
process.exit(1);
