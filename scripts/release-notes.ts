// Prints the latest release as a WhatsApp-ready announcement.
//   npm run release-notes
// Reads the same data the app shows (src/lib/releases.ts), so the message and
// the in-app "What's new" can never drift.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { APP_NAME, RELEASES, APP_VERSION } from "../src/lib/releases";

const here = path.dirname(fileURLToPath(import.meta.url));

// Guard: warn if package.json version and the latest release entry disagree.
try {
  const pkg = JSON.parse(readFileSync(path.join(here, "..", "package.json"), "utf8"));
  if (pkg.version !== APP_VERSION) {
    console.warn(
      `⚠ package.json version (${pkg.version}) != latest release (${APP_VERSION}).\n` +
        `  Run \`npm version ${APP_VERSION}\` or fix src/lib/releases.ts before announcing.\n`,
    );
  }
} catch {
  // ignore — best-effort check
}

const r = RELEASES[0];
const bullets = r.highlights.map((h, i) => `${i + 1}. ${h}`).join("\n");

const message = `Hey guys, I just released ${APP_NAME} v${r.version}. The new features are as follows:\n\n${bullets}`;

console.log("\n" + message + "\n");
