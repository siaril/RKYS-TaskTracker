// The default workflow seeded for every new project. Configurable per project
// in Phase 5. Order matters (used for `position`).
export const DEFAULT_STATUSES: { name: string; color: string }[] = [
  { name: "Open", color: "#c4c4c4" },
  { name: "In Progress", color: "#fdab3d" },
  { name: "Finish Dev", color: "#0073ea" },
  { name: "Testing", color: "#a25ddc" },
  { name: "Done", color: "#00c875" },
];

// The system "Deleted" column added to every project (pinned last, OWNER-only).
// kind=DELETED marks it; it's locked in the workflow editor.
export const DELETE_STATUS = { name: "Deleted", color: "#9ca3af" };
