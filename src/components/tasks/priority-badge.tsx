export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

const STYLES: Record<Priority, string> = {
  LOW: "bg-app text-muted",
  MEDIUM: "bg-primary/10 text-primary",
  HIGH: "bg-working/20 text-amber-700",
  URGENT: "bg-negative/15 text-negative",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  const label = priority.charAt(0) + priority.slice(1).toLowerCase();
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STYLES[priority]}`}>
      {label}
    </span>
  );
}
