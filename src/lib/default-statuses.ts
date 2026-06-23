// The default workflow seeded for every new project. Configurable per project
// in Phase 5. Order matters (used for `position`).
export const DEFAULT_STATUSES: { name: string; color: string }[] = [
  { name: "Open", color: "#c4c4c4" },
  { name: "In Progress", color: "#fdab3d" },
  { name: "Finish Dev", color: "#0073ea" },
  { name: "Testing", color: "#a25ddc" },
  { name: "Done", color: "#00c875" },
];
