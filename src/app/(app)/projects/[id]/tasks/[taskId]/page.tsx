import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2, CalendarDays } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getProjectAccess, atLeast } from "@/lib/access";
import { TaskForm } from "@/components/tasks/task-form";
import { PriorityBadge, type Priority } from "@/components/tasks/priority-badge";
import { TagChips } from "@/components/tasks/tag-chips";
import { Avatar } from "@/components/avatar";
import { CommentEditor } from "@/components/comments/comment-editor";
import { updateTask, deleteTask } from "@/lib/actions/tasks";
import { deleteComment } from "@/lib/actions/comments";
import { formatDueDate, toDateInputValue, formatDateTime } from "@/lib/format";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string; taskId: string }>;
}) {
  const { id, taskId } = await params;
  const user = await requireUser();

  const access = await getProjectAccess(id, user);
  if (!access) notFound();
  const canEdit = atLeast(access.role, "EDITOR");

  const task = await prisma.task.findFirst({
    where: { id: taskId, projectId: id },
    include: {
      status: true,
      assignee: { select: { name: true, email: true, image: true } },
      owner: { select: { name: true, email: true } },
      tags: { include: { tag: true } },
    },
  });
  if (!task) notFound();

  const [statuses, members, projectTags] = await Promise.all([
    canEdit
      ? prisma.workflowStatus.findMany({
          where: { projectId: id },
          orderBy: { position: "asc" },
          select: { id: true, name: true, color: true },
        })
      : Promise.resolve([]),
    canEdit
      ? prisma.projectMember.findMany({
          where: { projectId: id },
          include: { user: { select: { id: true, name: true, email: true } } },
        })
      : Promise.resolve([]),
    canEdit
      ? prisma.tag.findMany({
          where: { projectId: id },
          orderBy: { name: "asc" },
          select: { id: true, name: true, color: true },
        })
      : Promise.resolve([]),
  ]);
  const comments = await prisma.comment.findMany({
    where: { taskId: task.id },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { id: true, name: true, email: true, image: true } } },
  });

  const memberOptions = members.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    email: m.user.email,
  }));
  const ownerName = task.owner.name ?? task.owner.email ?? "Unknown";
  const assigneeName = task.assignee?.name ?? task.assignee?.email ?? null;
  const canModerate = atLeast(access.role, "OWNER");

  return (
    <div className="max-w-2xl">
      <Link
        href={`/projects/${id}`}
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Back to tasks
      </Link>

      <div className="mb-4 flex items-start justify-between gap-4">
        <h2 className="text-lg font-semibold text-ink">{canEdit ? "Edit task" : task.title}</h2>
        {canEdit && (
          <form action={deleteTask}>
            <input type="hidden" name="id" value={task.id} />
            <button
              type="submit"
              className="flex h-9 items-center gap-1.5 rounded-lg border border-border-strong px-3 text-sm font-medium text-muted hover:border-negative hover:bg-negative/10 hover:text-negative"
            >
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          </form>
        )}
      </div>

      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        {canEdit ? (
          <TaskForm
            action={updateTask}
            projectId={id}
            statuses={statuses}
            members={memberOptions}
            tags={projectTags}
            defaults={{
              id: task.id,
              title: task.title,
              description: task.description ?? "",
              statusId: task.statusId,
              priority: task.priority,
              assigneeId: task.assigneeId ?? "",
              dueDate: task.dueDate ? toDateInputValue(task.dueDate) : "",
              tagIds: task.tags.map((tt) => tt.tagId),
            }}
            submitLabel="Save changes"
            cancelHref={`/projects/${id}`}
          />
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-ink">
              {task.description || <span className="text-muted">No description</span>}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                style={{ backgroundColor: task.status.color }}
              >
                {task.status.name}
              </span>
              <PriorityBadge priority={task.priority as Priority} />
              {task.dueDate && (
                <span className="flex items-center gap-1 text-xs text-muted">
                  <CalendarDays className="h-3.5 w-3.5" /> {formatDueDate(task.dueDate)}
                </span>
              )}
              {assigneeName && (
                <span className="flex items-center gap-1.5 text-xs text-muted">
                  <Avatar src={task.assignee?.image} name={assigneeName} size={20} /> {assigneeName}
                </span>
              )}
            </div>
            {task.tags.length > 0 && (
              <TagChips tags={task.tags.map((tt) => ({ name: tt.tag.name, color: tt.tag.color }))} />
            )}
            <p className="text-xs text-muted">You have view-only access to this project.</p>
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-muted">Created by {ownerName}</p>

      {/* Comments */}
      <section className="mt-8">
        <h2 className="mb-3 font-semibold text-ink">
          Comments <span className="font-normal text-muted">({comments.length})</span>
        </h2>

        <ul className="mb-4 space-y-4">
          {comments.length === 0 && (
            <li className="text-sm text-muted">No comments yet. Start the discussion.</li>
          )}
          {comments.map((c) => {
            const authorName = c.author.name ?? c.author.email ?? "User";
            const canDelete = c.author.id === user.id || canModerate;
            return (
              <li key={c.id} className="flex gap-3">
                <Avatar src={c.author.image} name={authorName} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-ink">{authorName}</span>
                    <span className="text-xs text-muted">{formatDateTime(c.createdAt)}</span>
                    {canDelete && (
                      <form action={deleteComment} className="ml-auto">
                        <input type="hidden" name="id" value={c.id} />
                        <button
                          type="submit"
                          className="text-xs text-muted hover:text-negative"
                        >
                          Delete
                        </button>
                      </form>
                    )}
                  </div>
                  <div
                    className="comment-html mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink"
                    dangerouslySetInnerHTML={{ __html: c.bodyHtml }}
                  />
                </div>
              </li>
            );
          })}
        </ul>

        <CommentEditor taskId={task.id} />
      </section>
    </div>
  );
}
