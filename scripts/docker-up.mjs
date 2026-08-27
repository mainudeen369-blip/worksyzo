/**
 * Starts Postgres (pgvector) + Redis without requiring the Compose v2 plugin.
 * Idempotent: reuses existing containers named worksyzo-postgres / worksyzo-redis.
 */
import { execSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const initDir = path.join(root, 'infra', 'postgres-init');

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', shell: true });
}

function exists(name) {
  try {
    const out = execSync(`docker inspect -f "{{.State.Running}}" ${name}`, {
      stdio: ['ignore', 'pipe', 'ignore'],
      shell: true,
    })
      .toString()
      .trim();
    return out === 'true' || out === 'false' ? out : null;
  } catch {
    return null;
  }
}

function ensurePostgres() {
  const state = exists('worksyzo-postgres');
  if (state === 'true') {
    console.log('Postgres already running');
    return;
  }
  if (state === 'false') {
    run('docker start worksyzo-postgres');
    return;
  }
  run(
    [
      'docker run -d --name worksyzo-postgres',
      '-e POSTGRES_USER=postgres',
      '-e POSTGRES_PASSWORD=postgres',
      '-e POSTGRES_DB=worksyzo',
      '-p 5433:5432',
      `-v worksyzo-pgdata:/var/lib/postgresql/data`,
      `-v "${initDir}:/docker-entrypoint-initdb.d:ro"`,
      'pgvector/pgvector:pg16',
    ].join(' '),
  );
}

function ensureRedis() {
  const state = exists('worksyzo-redis');
  if (state === 'true') {
    console.log('Redis already running');
    return;
  }
  if (state === 'false') {
    run('docker start worksyzo-redis');
    return;
  }
  run('docker run -d --name worksyzo-redis -p 6380:6379 redis:7-alpine');
}

ensurePostgres();
ensureRedis();
console.log('Containers ready.');
