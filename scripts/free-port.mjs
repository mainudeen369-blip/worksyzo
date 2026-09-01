#!/usr/bin/env node
/**
 * Free a TCP port on Windows (kills LISTENING PID).
 * Usage: node scripts/free-port.mjs 3001
 */
import { execSync } from 'node:child_process';

const port = process.argv[2] ?? '3001';

function freePortWindows(targetPort) {
  try {
    const out = execSync(`netstat -ano | findstr :${targetPort}`, { encoding: 'utf8' });
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      if (!line.includes('LISTENING')) continue;
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && /^\d+$/.test(pid)) pids.add(pid);
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
        // eslint-disable-next-line no-console
        console.log(`Freed port ${targetPort} (killed PID ${pid})`);
      } catch {
        // already gone
      }
    }
    if (pids.size === 0) {
      // eslint-disable-next-line no-console
      console.log(`Port ${targetPort} is already free`);
    }
  } catch {
    // eslint-disable-next-line no-console
    console.log(`Port ${targetPort} is already free`);
  }
}

if (process.platform === 'win32') {
  freePortWindows(port);
} else {
  try {
    execSync(`npx --yes kill-port ${port}`, { stdio: 'inherit' });
  } catch {
    // eslint-disable-next-line no-console
    console.log(`Could not free port ${port} automatically on ${process.platform}`);
  }
}
