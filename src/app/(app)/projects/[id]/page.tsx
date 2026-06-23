import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getProjectAccess, atLeast } from "@/lib/access";
import { FlashToast } from "@/components/flash-toast";
import { KanbanBoard, type BoardTask } from "@/components/tasks/kanban-board";
import type { Priority } from "@/components/tasks/priority-badge";

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
      select: { id: true, name: true, color: true },
    }),
    prisma.task.findMany({
      where: { projectId: id },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      include: { assignee: { select: { name: true, email: true, image: true } } },
    }),
  ]);

  const tasksByStatus: Record<string, BoardTask[]> = {};
  for (const s of statuses) tasksByStatus[s.id] = [];
  for (const t of tasks) {
    (tasksByStatus[t.statusId] ??= []).push({
      id: t.id,
      title: t.title,
      priority: t.priority as Priority,
      dueDate: t.dueDate ? t.dueDate.toISOString() : null,
      assignee: t.assignee
        ? { name: t.assignee.name ?? t.assignee.email ?? "User", image: t.assignee.image }
        : null,
    });
  }

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

      {statuses.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border-strong p-8 text-center text-sm text-muted">
          This project has no workflow statuses. Add some under Settings.
        </p>
      ) : (
        <KanbanBoard
          projectId={id}
          statuses={statuses}
          tasksByStatus={tasksByStatus}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}
