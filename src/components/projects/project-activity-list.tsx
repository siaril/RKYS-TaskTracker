import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { formatDateTime } from "@/lib/format";

export type ProjectActivityItem = {
  id: string;
  type: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: Date;
  user: { name: string | null; email: string | null; image: string | null };
  task: { id: string; title: string };
};

// A verb phrase before the task link, and an optional detail phrase after it, so each row
// reads as "<name> <pre> <task> <post>" — e.g. "Maya moved Fix login from To Do to Doing".
function phrase(a: ProjectActivityItem): { pre: string; post: string } {
  const from = (o: string | null, n: string | null) => `from ${o ?? "none"} to ${n ?? "none"}`;
  switch (a.type) {
    case "CREATED":
      return { pre: "created", post: "" };
    case "COMMENTED":
      return { pre: "commented on", post: "" };
    case "COMMENT_DELETED":
      return { pre: "deleted a comment on", post: "" };
    case "DELETED":
      return { pre: "deleted", post: "" };
    case "RESTORED":
      return { pre: "restored", post: "" };
    case "STATUS_CHANGED":
      return { pre: "moved", post: from(a.oldValue, a.newValue) };
  }
  // UPDATED
  switch (a.field) {
    case "title":
      return { pre: "renamed", post: a.oldValue ? `(was “${a.oldValue}”)` : "" };
    case "description":
      return { pre: "updated the description of", post: "" };
    case "priority":
      return { pre: "changed the priority of", post: from(a.oldValue, a.newValue) };
    case "assignee":
      return { pre: "changed the assignee of", post: from(a.oldValue, a.newValue) };
    case "dueDate":
      return { pre: "changed the due date of", post: from(a.oldValue, a.newValue) };
    case "attachment":
      return a.newValue
        ? { pre: "attached a file to", post: "" }
        : { pre: "removed a file from", post: "" };
    default:
      return { pre: "updated", post: "" };
  }
}

export function ProjectActivityList({
  projectId,
  items,
}: {
  projectId: string;
  items: ProjectActivityItem[];
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border-strong p-8 text-center text-sm text-muted">
        No activity matches these filters.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {items.map((a) => {
        const name = a.user.name ?? a.user.email ?? "User";
        const { pre, post } = phrase(a);
        return (
          <li key={a.id} className="flex items-start gap-3">
            <Avatar src={a.user.image} name={name} size={26} />
            <p className="text-sm text-muted">
              <span className="font-medium text-ink">{name}</span> {pre}{" "}
              <Link
                href={`/projects/${projectId}/tasks/${a.task.id}`}
                className="font-medium text-ink hover:text-primary hover:underline"
              >
                {a.task.title}
              </Link>
              {post && <> {post}</>}
              <span className="ml-1.5 whitespace-nowrap text-xs">· {formatDateTime(a.createdAt)}</span>
            </p>
          </li>
        );
      })}
    </ul>
  );
}
