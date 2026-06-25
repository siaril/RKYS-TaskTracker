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
    highlights: [
      "Reply to any comment — replies now @mention who they're directed to, so threads stay clear.",
      "Mention teammates with @ in comments and task descriptions.",
      "Delete tasks safely: a deleted task moves to a new Deleted column instead of being gone for good, and project owners can restore it.",
      "Take over a task with a new \"Assign to me\" button — and each task now shows who created it and who's assigned right at the top.",
      "Get notified: a bell in the top-right tells you when you're assigned a task, @mentioned, or someone comments on a task you're assigned to or created.",
      "See the app version in the sidebar, plus a \"What's new\" popup whenever we ship an update.",
    ],
  },
];

export const latestRelease: Release = RELEASES[0];
export const APP_VERSION: string = latestRelease.version;
