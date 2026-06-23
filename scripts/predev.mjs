// Runs automatically before `npm run dev` (npm "predev" lifecycle).
// Kills any STALE Next.js dev server still running from a previous start, so
// multiple instances can't stack up and exhaust all RAM. See CLAUDE.md memory rules.
//
// It only targets node processes whose command line is a Next.js dev server
// (contains both "next" and " dev"); it never touches the Claude/editor process
// or this script itself.
import { execSync } from "node:child_process";

function run(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return "";
  }
}

const myPid = process.pid;

if (process.platform === "win32") {
  const ps = `
$me = ${myPid}
$targets = Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object {
    $_.ProcessId -ne $me -and
    $_.CommandLine -like '*next*' -and
    $_.CommandLine -like '* dev*'
  }
foreach ($p in $targets) {
  Write-Output ("Stopped stale Next dev server (PID " + $p.ProcessId + ")")
  taskkill /F /T /PID $p.ProcessId | Out-Null
}
`;
  const encoded = Buffer.from(ps, "utf16le").toString("base64");
  const out = run(`powershell -NoProfile -EncodedCommand ${encoded}`).trim();
  if (out) console.log(out);
} else {
  // macOS / Linux
  run(`pkill -f "next dev"`);
}
