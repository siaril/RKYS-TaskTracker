import { Avatar } from "@/components/avatar";
import { formatDateTime } from "@/lib/format";

export type ActivityItem = {
  id: string;
  type: "CREATED" | "UPDATED" | "STATUS_CHANGED" | "COMMENTED" | "COMMENT_DELETED";
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: Date;
  user: { name: string | null; email: string | null; image: string | null };
};

function describe(a: ActivityItem): string {
  if (a.type === "CREATED") return "created this task";
  if (a.type === "COMMENTED") return "added a comment";
  if (a.type === "COMMENT_DELETED") return "deleted a comment";
  if (a.type === "STATUS_CHANGED") return `moved status from ${a.oldValue} to ${a.newValue}`;
  switch (a.field) {
    case "title":
      return `renamed it from “${a.oldValue}” to “${a.newValue}”`;
    case "description":
      return "updated the description";
    case "priority":
      return `changed priority from ${a.oldValue} to ${a.newValue}`;
    case "assignee":
      return `changed assignee from ${a.oldValue} to ${a.newValue}`;
    case "dueDate":
      return `changed due date from ${a.oldValue} to ${a.newValue}`;
    case "attachment":
      return a.newValue ? `attached ${a.newValue}` : `removed ${a.oldValue}`;
    default:
      return "updated this task";
  }
}

export function ActivityFeed({ activities }: { activities: ActivityItem[] }) {
  if (activities.length === 0) {
    return <p className="text-sm text-muted">No activity yet.</p>;
  }
  return (
    <ul className="space-y-3">
      {activities.map((a) => {
        const name = a.user.name ?? a.user.email ?? "User";
        return (
          <li key={a.id} className="flex items-start gap-3">
            <Avatar src={a.user.image} name={name} size={26} />
            <p className="text-sm text-muted">
              <span className="font-medium text-ink">{name}</span> {describe(a)}
              <span className="ml-1.5 text-xs text-muted">· {formatDateTime(a.createdAt)}</span>
            </p>
          </li>
        );
      })}
    </ul>
  );
}
