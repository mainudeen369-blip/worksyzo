import { processNextPendingDocument } from '@worksyzo/ingest';
import { closePools, optionalEnv } from '@worksyzo/db';

const POLL_MS = Number(optionalEnv('WORKER_POLL_MS', '3000'));

/**
 * Step B worker: polls Postgres for pending documents and runs ingest.
 * No Redis required. Safe to run alongside the API's fire-and-forget kick.
 */
async function main(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`[worker] Worksyzo worker online (Step B — document ingest)`);
  // eslint-disable-next-line no-console
  console.log(`[worker] Polling every ${POLL_MS}ms for pending documents`);

  let stopped = false;
  const shutdown = async () => {
    if (stopped) return;
    stopped = true;
    // eslint-disable-next-line no-console
    console.log('[worker] shutting down');
    await closePools().catch(() => undefined);
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());

  while (!stopped) {
    try {
      const worked = await processNextPendingDocument();
      if (!worked) await sleep(POLL_MS);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[worker] ingest loop error:', (error as Error).message);
      await sleep(POLL_MS);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch(async (error: Error) => {
  // eslint-disable-next-line no-console
  console.error('[worker] failed:', error.message);
  await closePools().catch(() => undefined);
  process.exit(1);
});
