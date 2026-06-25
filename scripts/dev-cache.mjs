// Shared helpers for recovering from an UNCLEAN dev-server exit.
//
// Why this exists: a forced kill (the dev-guard's `taskkill /F /T`), an external
// `taskkill`, or a laptop crash can leave the Next/Turbopack `.next` cache
// half-written. On the next `npm run dev` the build workers crash-loop trying to
// read that corrupt cache and respawn out of control — the fork bomb the
// dev-guard then has to kill (see CLAUDE.md memory rules). The verified fix is to
// wipe `.next` and start cold.
//
// We can't tell "corrupt cache" from "fine cache" by inspection, so instead we
// track whether the PREVIOUS run shut down cleanly: dev.mjs drops a lock file on
// start and removes it only on a graceful Ctrl-C. If predev finds the lock still
// present at the next start, the last run died uncleanly → wipe `.next`.
//
// The lock lives in the OS temp dir (keyed by project path) so it survives
// process death and a reboot, and never clutters `git status`.
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { existsSync, writeFileSync, rmSync, mkdirSync } from "node:fs";

const projectHash = crypto
  .createHash("md5")
  .update(process.cwd())
  .digest("hex")
  .slice(0, 8);

export const lockFile = path.join(os.tmpdir(), `tasktracker-dev-${projectHash}.lock`);
const nextDir = path.join(process.cwd(), ".next");

// Record that a dev run is in progress.
export function markDevActive() {
  try {
    mkdirSync(path.dirname(lockFile), { recursive: true });
    writeFileSync(lockFile, String(process.pid));
  } catch {}
}

// Mark the run as having ended cleanly (call on graceful Ctrl-C / normal exit).
export function markDevClean() {
  try {
    rmSync(lockFile, { force: true });
  } catch {}
}

// True if the previous run never marked itself clean → forced kill or crash.
export function wasUncleanExit() {
  return existsSync(lockFile);
}

// Wipe the Next build cache. Retries a few times because Windows may still hold
// file handles for a moment after the worker tree is force-killed.
export function clearNextCache() {
  if (!existsSync(nextDir)) return false;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      rmSync(nextDir, { recursive: true, force: true });
      return true;
    } catch {
      // brief synchronous back-off to let the OS release handles
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 150);
    }
  }
  return false;
}
