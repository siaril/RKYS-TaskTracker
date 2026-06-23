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

const TREE_CAP_MB = Number(process.env.DEV_TREE_CAP_MB || 3000);
const FREE_FLOOR_MB = Number(process.env.DEV_FREE_FLOOR_MB || 800);
const WARN_TREE_MB = Math.round(TREE_CAP_MB * 0.7);
const MB = 1024 * 1024;
const isWin = process.platform === "win32";

killStaleDevServers();

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
  const tree = nodeTreeMB();
  const free = Math.round(os.freemem() / MB);

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
  process.exit(code ?? 0);
});
process.on("SIGINT", () => gracefulStop());
process.on("SIGTERM", () => gracefulStop());

function gracefulStop() {
  if (stopping) return;
  stopping = true;
  clearInterval(timer);
  killTree(child.pid);
  process.exit(0);
}

function nodeTreeMB() {
  try {
    if (isWin) {
      const out = execSync('tasklist /FI "IMAGENAME eq node.exe" /FO CSV /NH', {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      let kb = 0;
      for (const line of out.split(/\r?\n/)) {
        const m = line.match(/"([\d.,]+) K"\s*$/);
        if (m) kb += parseInt(m[1].replace(/[.,]/g, ""), 10);
      }
      return Math.round(kb / 1024);
    }
    const out = execSync("ps -A -o rss,comm | awk '/node/{s+=$1} END{print s+0}'", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return Math.round(Number(out.trim()) / 1024);
  } catch {
    return 0;
  }
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
      const ps = `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.ProcessId -ne ${process.pid} -and $_.CommandLine -like '*next*' -and $_.CommandLine -like '* dev*' } | ForEach-Object { taskkill /F /T /PID $_.ProcessId | Out-Null }`;
      const enc = Buffer.from(ps, "utf16le").toString("base64");
      execSync(`powershell -NoProfile -EncodedCommand ${enc}`, { stdio: "ignore" });
    } else {
      execSync(`pkill -f "next dev" || true`, { stdio: "ignore" });
    }
  } catch {}
}
