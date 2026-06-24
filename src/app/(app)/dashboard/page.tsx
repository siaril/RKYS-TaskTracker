import Link from "next/link";
import { CalendarDays, Flame, AlertTriangle, CheckCircle2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { PriorityBadge, type Priority } from "@/components/tasks/priority-badge";
import { formatDueDate } from "@/lib/format";

const PRIORITY_RANK: Record<Priority, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

/** Start of today in UTC (dueDate is stored at UTC midnight — compare in UTC). */
function startOfTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export default async function DashboardPage() {
  const user = await requireUser();
  const firstName = (user.name ?? "there").split(" ")[0];

  // All tasks assigned to me, with their status + project context.
  const assigned = await prisma.task.findMany({
    where: { assigneeId: user.id },
    include: {
      status: { select: { id: true, name: true, color: true, position: true } },
      project: { select: { id: true, name: true, client: { select: { name: true } } } },
    },
  });

  // Hide "finished" tasks: treat each project's last workflow column (the highest
  // position) as done. Find that max position per project, then drop tasks in it.
  const projectIds = [...new Set(assigned.map((t) => t.projectId))];
  const maxByProject = new Map<string, number>();
  if (projectIds.length > 0) {
    const grouped = await prisma.workflowStatus.groupBy({
      by: ["projectId"],
      where: { projectId: { in: projectIds } },
      _max: { position: true },
    });
    for (const g of grouped) maxByProject.set(g.projectId, g._max.position ?? 0);
  }

  const today = startOfTodayUTC();
  const active = assigned
    .filter((t) => t.status.position !== maxByProject.get(t.projectId))
    .map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority as Priority,
      dueDate: t.dueDate,
      overdue: t.dueDate ? t.dueDate < today : false,
      status: t.status,
      projectId: t.projectId,
      projectName: t.project.name,
      clientName: t.project.client.name,
    }))
    .sort((a, b) => {
      const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (p !== 0) return p;
      // Then by due date: soonest/overdue first, tasks without a date last.
      if (a.dueDate && b.dueDate) return a.dueDate.getTime() - b.dueDate.getTime();
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return 0;
    });

  const urgentCount = active.filter((t) => t.priority === "URGENT").length;
  const overdueCount = active.filter((t) => t.overdue).length;
  const hasUrgent = urgentCount > 0;

  return (
    <div className="mx-auto max-w-4xl">
      <header
        className={cn(
          "rounded-2xl border p-5",
          hasUrgent
            ? "border-negative/40 bg-negative/5 ring-1 ring-negative/30"
            : "border-border bg-surface shadow-sm",
        )}
      >
        <h1 className="text-2xl font-bold text-ink">Hi {firstName} 👋</h1>
        <p className="mt-1 text-sm text-muted">Here&apos;s what&apos;s on your plate.</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Stat label="Assigned" value={active.length} />
          <Stat label="Urgent" value={urgentCount} tone={urgentCount > 0 ? "negative" : "muted"} />
          <Stat label="Overdue" value={overdueCount} tone={overdueCount > 0 ? "working" : "muted"} />
        </div>
      </header>

      {hasUrgent && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-negative/40 bg-negative/10 px-4 py-3 text-sm font-semibold text-negative">
          <Flame className="h-5 w-5 shrink-0" />
          You have {urgentCount} urgent {urgentCount === 1 ? "task" : "tasks"} — handle{" "}
          {urgentCount === 1 ? "it" : "them"} first. 🔥
        </div>
      )}

      <section className="mt-6">
        <h2 className="mb-3 text-base font-semibold text-ink">My tasks</h2>

        {active.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-strong p-10 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-positive" />
            <p className="mt-2 text-sm text-muted">
              You&apos;re all caught up — no active tasks assigned to you. 🎉
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {active.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/projects/${t.projectId}/tasks/${t.id}`}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border bg-surface p-3 shadow-sm transition-shadow hover:shadow-md",
                    t.priority === "URGENT" ? "border-negative/30" : "border-border",
                  )}
                >
                  <PriorityBadge priority={t.priority} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{t.title}</p>
                    <p className="truncate text-xs text-muted">
                      {t.projectName} · {t.clientName}
                    </p>
                  </div>
                  <span
                    className="hidden shrink-0 rounded-full px-2 py-0.5 text-xs font-medium text-white sm:inline"
                    style={{ backgroundColor: t.status.color }}
                  >
                    {t.status.name}
                  </span>
                  {t.dueDate && (
                    <span
                      className={cn(
                        "flex shrink-0 items-center gap-1 text-xs",
                        t.overdue ? "font-semibold text-negative" : "text-muted",
                      )}
                    >
                      {t.overdue ? (
                        <AlertTriangle className="h-3.5 w-3.5" />
                      ) : (
                        <CalendarDays className="h-3.5 w-3.5" />
                      )}
                      {formatDueDate(t.dueDate)}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: number;
  tone?: "muted" | "negative" | "working";
}) {
  const toneClass =
    tone === "negative"
      ? "text-negative"
      : tone === "working"
        ? "text-amber-600"
        : "text-ink";
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-1.5">
      <span className={cn("text-lg font-bold", toneClass)}>{value}</span>{" "}
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}
