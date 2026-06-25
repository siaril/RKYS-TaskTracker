import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getProjectAccess, atLeast, canModifyTask } from "@/lib/access";
import { cn } from "@/lib/utils";
import { FlashToast } from "@/components/flash-toast";
import { KanbanBoard, type BoardTask } from "@/components/tasks/kanban-board";
import type { Priority } from "@/components/tasks/priority-badge";

export default async function ProjectTasksPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ toast?: string; tag?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const activeTag = sp.tag;
  const user = await requireUser();

  const access = await getProjectAccess(id, user);
  if (!access) notFound();
  const canEdit = atLeast(access.role, "EDITOR");
  // Only OWNERs/admins can see the Deleted column and the tasks inside it.
  const isOwner = access.isAdmin || access.role === "OWNER";

  const [allStatuses, projectTags, tasks] = await Promise.all([
    prisma.workflowStatus.findMany({
      where: { projectId: id },
      orderBy: [{ kind: "asc" }, { position: "asc" }], // NORMAL columns first, Deleted last
      select: { id: true, name: true, color: true, kind: true },
    }),
    prisma.tag.findMany({
      where: { projectId: id },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true },
    }),
    prisma.task.findMany({
      where: {
        projectId: id,
        ...(activeTag ? { tags: { some: { tagId: activeTag } } } : {}),
        // Non-owners never see deleted tasks.
        ...(isOwner ? {} : { status: { kind: "NORMAL" } }),
      },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      include: {
        assignee: { select: { name: true, email: true, image: true } },
        tags: { include: { tag: true } },
        _count: { select: { comments: true } },
      },
    }),
  ]);

  // Owners get the Deleted column; everyone else only the normal columns.
  const statuses = isOwner ? allStatuses : allStatuses.filter((s) => s.kind === "NORMAL");
  const deletedStatusIds = new Set(
    allStatuses.filter((s) => s.kind === "DELETED").map((s) => s.id),
  );
  // Headline count = active (non-deleted) tasks only.
  const activeCount = tasks.filter((t) => !deletedStatusIds.has(t.statusId)).length;

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
      tags: t.tags.map((tt) => ({ name: tt.tag.name, color: tt.tag.color })),
      commentCount: t._count.comments,
      canModify: canModifyTask(access, { ownerId: t.ownerId, assigneeId: t.assigneeId }, user.id),
    });
  }

  return (
    <div>
      <FlashToast type={sp.toast} />

      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {activeCount} {activeCount === 1 ? "task" : "tasks"}
          {activeTag ? " (filtered)" : ""}
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

      {projectTags.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted">Filter:</span>
          <TagFilterChip href={`/projects/${id}`} label="All" active={!activeTag} />
          {projectTags.map((t) => (
            <TagFilterChip
              key={t.id}
              href={`/projects/${id}?tag=${t.id}`}
              label={t.name}
              color={t.color}
              active={activeTag === t.id}
            />
          ))}
        </div>
      )}

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

function TagFilterChip({
  href,
  label,
  color,
  active,
}: {
  href: string;
  label: string;
  color?: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active ? "border-primary bg-primary/10 text-primary" : "border-border-strong text-muted hover:bg-app",
      )}
    >
      {color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />}
      {label}
    </Link>
  );
}
