// Memory-aware dev supervisor.
//
// Why this exists: this laptop runs lots of background apps, so RAM headroom is
// small. A Next.js dev server on top can, in a bad case, balloon and exhaust all
// memory — which previously HARD-CRASHED the laptop (see CLAUDE.md memory rules).
//
// This wrapper runs `next dev` and watches memory every ~1.5s. If the dev server
// grows past a cap, OR free system RAM falls dangerously low, it kills the dev
// server immediately — the machine stays alive, you just restart it.
//
// Tunable via env vars (MB): DEV_TREE_CAP_MB (default 3000), DEV_FREE_FLOOR_MB (800).
import { spawn, execSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { markDevActive, markDevClean } from "./dev-cache.mjs";

const TREE_CAP_MB = Number(process.env.DEV_TREE_CAP_MB || 3000);
const FREE_FLOOR_MB = Number(process.env.DEV_FREE_FLOOR_MB || 800);
// Fork-bomb guard: Next dev spawns ~1 build worker per CPU core. If the tree
// blows past this, build workers are crash-respawning out of control — kill it
// before it eats all RAM. (We've seen 1000+ orphaned workers exhaust memory.)
const MAX_TREE_PROCS = Number(process.env.DEV_MAX_TREE_PROCS || 64);
const WARN_TREE_MB = Math.round(TREE_CAP_MB * 0.7);
const MB = 1024 * 1024;
const isWin = process.platform === "win32";

killStaleDevServers();

// Record that a dev run is in progress. Only a graceful Ctrl-C clears this; if a
// forced kill or crash leaves it behind, the next `npm run dev` (predev) wipes the
// possibly-corrupt .next cache before starting. See scripts/dev-cache.mjs.
markDevActive();

const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
const child = spawn(process.execPath, [nextBin, "dev"], {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --max-old-space-size=2048`.trim(),
  },
});

let stopping = false;
let lowFree = 0;
let warnedTree = false;

const timer = setInterval(check, 1500);

function check() {
  const { mb: tree, procs } = devTreeStats();
  const free = Math.round(os.freemem() / MB);

  // Fork-bomb guard fires first — catches runaway worker spawning early, before
  // RAM is gone (and before the memory metric balloons from 1000+ processes).
  if (procs > MAX_TREE_PROCS) {
    return stop(`runaway worker spawn detected (${procs} node processes in the dev tree)`, 1);
  }

  if (tree > WARN_TREE_MB && !warnedTree) {
    console.warn(`\n[dev-guard] ⚠ dev server using ${tree} MB (cap ${TREE_CAP_MB} MB). Watching closely…`);
    warnedTree = true;
  }
  if (tree <= WARN_TREE_MB) warnedTree = false;

  if (tree > TREE_CAP_MB) {
    return stop(`dev server hit ${tree} MB (> ${TREE_CAP_MB} MB cap)`, 1);
  }

  if (free < FREE_FLOOR_MB) {
    lowFree++;
    if (lowFree >= 2) {
      return stop(`free system RAM critically low (${free} MB)`, 1);
    }
  } else {
    lowFree = 0;
  }
}

function stop(reason, code) {
  if (stopping) return;
  stopping = true;
  clearInterval(timer);
  console.error(`\n[dev-guard] ✗ Stopping dev server: ${reason}.`);
  console.error(`[dev-guard]   Your laptop is safe. Close some apps (Chrome tabs, etc.) and run \`npm run dev\` again.`);
  killTree(child.pid);
  process.exit(code);
}

child.on("exit", (code) => {
  clearInterval(timer);
  // Next dev exited on its own. A clean exit means the cache is trustworthy;
  // a non-zero exit (crash) is left marked unclean so predev wipes it next time.
  if (!stopping && (code ?? 0) === 0) markDevClean();
  process.exit(code ?? 0);
});
process.on("SIGINT", () => gracefulStop());
process.on("SIGTERM", () => gracefulStop());

function gracefulStop() {
  if (stopping) return;
  stopping = true;
  clearInterval(timer);
  markDevClean(); // user-initiated Ctrl-C → cache is clean, keep it for a fast restart
  killTree(child.pid);
  process.exit(0);
}

// Memory AND process count of ONLY the dev server's own process tree (the spawned
// `child` + its descendants) — NOT every node.exe on the machine. Summing all node
// processes would wrongly include Claude Code, other coding agents, language
// servers, etc. and trip the cap instantly when several are running.
function devTreeStats() {
  const root = child?.pid;
  if (!root) return { mb: 0, procs: 0 };
  try {
    let procs;
    if (isWin) {
      // One CIM dump of every process (pid, parent pid, working set bytes).
      const ps =
        "Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,WorkingSetSize | ConvertTo-Csv -NoTypeInformation";
      const enc = Buffer.from(ps, "utf16le").toString("base64");
      const out = execSync(`powershell -NoProfile -EncodedCommand ${enc}`, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      procs = [];
      for (const line of out.split(/\r?\n/)) {
        const m = line.match(/^"?(\d+)"?,"?(\d+)"?,"?(\d+)"?/);
        if (m) procs.push({ pid: +m[1], ppid: +m[2], bytes: +m[3] });
      }
    } else {
      const out = execSync("ps -A -o pid=,ppid=,rss=", {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      procs = [];
      for (const line of out.trim().split(/\r?\n/)) {
        const m = line.trim().match(/^(\d+)\s+(\d+)\s+(\d+)/);
        if (m) procs.push({ pid: +m[1], ppid: +m[2], bytes: +m[3] * 1024 }); // rss is KB
      }
    }
    const { bytes, count } = subtreeStats(procs, root);
    return { mb: Math.round(bytes / MB), procs: count };
  } catch {
    return { mb: 0, procs: 0 };
  }
}

// Sum the working-set/RSS bytes AND count of `root` plus all descendant processes.
function subtreeStats(procs, root) {
  const childrenOf = new Map();
  const byPid = new Map();
  for (const p of procs) {
    byPid.set(p.pid, p);
    if (!childrenOf.has(p.ppid)) childrenOf.set(p.ppid, []);
    childrenOf.get(p.ppid).push(p.pid);
  }
  const seen = new Set();
  const stack = [root];
  let bytes = 0;
  let count = 0;
  while (stack.length) {
    const pid = stack.pop();
    if (seen.has(pid)) continue;
    seen.add(pid);
    const self = byPid.get(pid);
    if (self) {
      bytes += self.bytes;
      count++;
    }
    for (const c of childrenOf.get(pid) ?? []) stack.push(c);
  }
  return { bytes, count };
}

function killTree(pid) {
  try {
    if (isWin) execSync(`taskkill /F /T /PID ${pid}`, { stdio: "ignore" });
    else process.kill(-pid, "SIGKILL");
  } catch {}
}

function killStaleDevServers() {
  try {
    if (isWin) {
      const ps = `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.ProcessId -ne ${process.pid} -and ( $_.CommandLine -like '*\\.next\\dev\\build\\*' -or ($_.CommandLine -like '*next*' -and $_.CommandLine -like '* dev*') ) } | ForEach-Object { taskkill /F /T /PID $_.ProcessId | Out-Null }`;
      const enc = Buffer.from(ps, "utf16le").toString("base64");
      execSync(`powershell -NoProfile -EncodedCommand ${enc}`, { stdio: "ignore" });
    } else {
      execSync(`pkill -f "next dev" || true`, { stdio: "ignore" });
      execSync(`pkill -f "\\.next/dev/build/" || true`, { stdio: "ignore" });
    }
  } catch {}
}
