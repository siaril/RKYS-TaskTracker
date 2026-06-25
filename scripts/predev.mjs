// Runs automatically before `npm run dev` (npm "predev" lifecycle).
// Kills any STALE Next.js dev server still running from a previous start, so
// multiple instances can't stack up and exhaust all RAM. See CLAUDE.md memory rules.
//
// It targets (a) Next dev servers (command line has "next" and " dev") AND
// (b) orphaned Next dev BUILD WORKERS (command line has "\.next\dev\build\").
// Those workers (one per CPU core, plus respawns) used to slip through the old
// "next" + " dev" filter and pile up across restarts until they fork-bombed the
// machine. It never touches the Claude/editor process or this script itself.
import { execSync } from "node:child_process";
import { wasUncleanExit, markDevClean, clearNextCache } from "./dev-cache.mjs";

function run(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return "";
  }
}

const myPid = process.pid;

// Did the previous dev run die uncleanly (forced kill / crash)? Detect it BEFORE
// we kill strays below — finding stale workers is itself a sign of an unclean exit.
const uncleanExit = wasUncleanExit();
let staleFound = false;

if (process.platform === "win32") {
  const ps = `
$me = ${myPid}
$targets = Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object {
    $_.ProcessId -ne $me -and (
      $_.CommandLine -like '*\.next\dev\build\*' -or
      ($_.CommandLine -like '*next*' -and $_.CommandLine -like '* dev*')
    )
  }
$count = ($targets | Measure-Object).Count
if ($count -gt 0) { Write-Output ("Cleaned up " + $count + " stale Next dev process(es)") }
foreach ($p in $targets) {
  taskkill /F /T /PID $p.ProcessId | Out-Null
}
`;
  const encoded = Buffer.from(ps, "utf16le").toString("base64");
  const out = run(`powershell -NoProfile -EncodedCommand ${encoded}`).trim();
  if (out) {
    console.log(out);
    staleFound = true;
  }
} else {
  // macOS / Linux
  run(`pkill -f "next dev"`);
  run(`pkill -f "\\.next/dev/build/"`);
}

// If the previous run died uncleanly, its `.next` cache may be half-written and
// will fork-bomb the build workers on start. Wipe it so we start cold and safe.
// A clean Ctrl-C removes the lock, so healthy restarts keep their cache (fast).
if (uncleanExit || staleFound) {
  const cleared = clearNextCache();
  console.log(
    cleared
      ? "[predev] Previous dev run didn't exit cleanly — cleared .next cache to prevent the build-worker fork bomb."
      : "[predev] Previous dev run didn't exit cleanly (no .next cache to clear).",
  );
}
// Consume the lock; dev.mjs writes a fresh one when it starts.
markDevClean();
