// Release history — the single source for the in-app "What's new" modal, the
// sidebar version badge, and the WhatsApp announcement (`npm run release-notes`).
//
// HOW TO CUT A RELEASE:
//   1. Add a new entry at the TOP of RELEASES (newest first) with today's date.
//   2. Keep `version` semver and matching package.json (`npm version minor|patch`).
//   3. Deploy, then run `npm run release-notes` and paste the output to WhatsApp.
// The latest entry's version is what the app shows everywhere (APP_VERSION).

export const APP_NAME = "Rekayasa Task Tracker";

export type Release = {
  version: string; // semver, e.g. "0.2.0" — must match package.json at release time
  date: string; // ISO date, "YYYY-MM-DD"
  highlights: string[]; // user-facing bullet points (what to announce)
};

// Newest first.
export const RELEASES: Release[] = [
  {
    version: "0.2.0",
    date: "2026-06-25",
    // DRAFT — edit before you cut today's release; add the other features you ship.
    highlights: [
      "Reply directly to any comment — replies now @mention who they're directed to, so threads stay clear.",
      "Mention teammates with @ in comments and task descriptions.",
    ],
  },
];

export const latestRelease: Release = RELEASES[0];
export const APP_VERSION: string = latestRelease.version;
