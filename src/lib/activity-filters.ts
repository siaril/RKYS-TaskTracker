import type { Prisma } from "@/generated/prisma/client";

// Friendly activity-type categories for the Project Activity filter. The underlying
// TaskActivity rows use a finer (type, field) encoding; these map onto how people think
// ("assigned" / "moved" / "edited"). `import type` keeps Prisma out of the client bundle,
// so the client filter component can import ACTIVITY_CATEGORIES safely.
export const ACTIVITY_CATEGORIES = [
  { key: "all", label: "All activity" },
  { key: "created", label: "Created" },
  { key: "moved", label: "Moved (status)" },
  { key: "assigned", label: "Assigned" },
  { key: "edited", label: "Edited" },
  { key: "commented", label: "Commented" },
  { key: "deleted", label: "Deleted / restored" },
] as const;

export type ActivityCategoryKey = (typeof ACTIVITY_CATEGORIES)[number]["key"];

// "Edited" = any UPDATED that isn't an assignee change (those get their own category).
const EDIT_FIELDS = ["title", "description", "priority", "dueDate", "attachment"];

/** Prisma where fragment for a friendly category. `{}` (the default) matches everything. */
export function activityTypeWhere(key: string): Prisma.TaskActivityWhereInput {
  switch (key) {
    case "created":
      return { type: "CREATED" };
    case "moved":
      return { type: "STATUS_CHANGED" };
    case "assigned":
      return { type: "UPDATED", field: "assignee" };
    case "edited":
      return { type: "UPDATED", field: { in: EDIT_FIELDS } };
    case "commented":
      return { type: { in: ["COMMENTED", "COMMENT_DELETED"] } };
    case "deleted":
      return { type: { in: ["DELETED", "RESTORED"] } };
    default:
      return {};
  }
}
