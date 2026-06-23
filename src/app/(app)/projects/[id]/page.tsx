import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, CalendarDays, ListTodo } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getProjectAccess, atLeast } from "@/lib/access";
import { PriorityBadge, type Priority } from "@/components/tasks/priority-badge";
import { Avatar } from "@/components/avatar";
import { FlashToast } from "@/components/flash-toast";
import { formatDueDate } from "@/lib/format";

export default async function ProjectTasksPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ toast?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();

  const access = await getProjectAccess(id, user);
  if (!access) notFound();
  const canEdit = atLeast(access.role, "EDITOR");

  const [statuses, tasks] = await Promise.all([
    prisma.workflowStatus.findMany({
      where: { projectId: id },
      orderBy: { position: "asc" },
    }),
    prisma.task.findMany({
      where: { projectId: id },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      include: { assignee: { select: { name: true, email: true, image: true } } },
    }),
  ]);

  const byStatus = new Map<string, typeof tasks>();
  for (const s of statuses) byStatus.set(s.id, []);
  for (const t of tasks) byStatus.get(t.statusId)?.push(t);

  return (
    <div>
      <FlashToast type={sp.toast} />

      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted">
          {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
        </p>
        {canEdit && (
          <Link
            href={`/projects/${id}/tasks/new`}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
          >
            <Plus className="h-4 w-4" /> New task
          </Link>
        )}
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-strong p-10 text-center">
          <ListTodo className="mx-auto h-8 w-8 text-muted" />
          <p className="mt-2 text-sm text-muted">
            No tasks yet.{canEdit ? " Add the first one." : ""}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {statuses.map((s) => {
            const list = byStatus.get(s.id) ?? [];
            return (
              <section key={s.id}>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  {s.name}
                  <span className="font-normal text-muted">({list.length})</span>
                </h3>

                {list.length === 0 ? (
                  <p className="pl-4 text-xs text-muted">No tasks</p>
                ) : (
                  <ul className="space-y-2">
                    {list.map((t) => {
                      const assigneeName = t.assignee?.name ?? t.assignee?.email ?? null;
                      return (
                        <li key={t.id}>
                          <Link
                            href={`/projects/${id}/tasks/${t.id}`}
                            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3 shadow-sm transition-shadow hover:shadow-md"
                          >
                            <span className="truncate text-sm font-medium text-ink">{t.title}</span>
                            <div className="flex shrink-0 items-center gap-3">
                              {t.dueDate && (
                                <span className="flex items-center gap-1 text-xs text-muted">
                                  <CalendarDays className="h-3.5 w-3.5" />
                                  {formatDueDate(t.dueDate)}
                                </span>
                              )}
                              <PriorityBadge priority={t.priority as Priority} />
                              {assigneeName ? (
                                <Avatar src={t.assignee?.image} name={assigneeName} size={24} />
                              ) : (
                                <span className="text-xs text-muted">—</span>
                              )}
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
