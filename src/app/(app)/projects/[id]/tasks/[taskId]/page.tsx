import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Paperclip, Download, X, Trash2, RotateCcw, UserPlus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getProjectAccess, canModifyTask, canDeleteTask, atLeast } from "@/lib/access";
import { getTaskComments } from "@/lib/actions/comments";
import { TaskForm } from "@/components/tasks/task-form";
import { PriorityBadge, type Priority } from "@/components/tasks/priority-badge";
import { TagChips } from "@/components/tasks/tag-chips";
import { Avatar } from "@/components/avatar";
import { CommentThread } from "@/components/comments/comment-thread";
import { ActivityFeed } from "@/components/tasks/activity-feed";
import { TaskAttachmentUploader } from "@/components/tasks/task-attachment-uploader";
import { updateTask, deleteTask, restoreTask, assignToMe } from "@/lib/actions/tasks";
import { deleteTaskAttachment } from "@/lib/actions/attachments";
import { FlashToast } from "@/components/flash-toast";
import { formatDueDate, toDateInputValue } from "@/lib/format";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function TaskDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; taskId: string }>;
  searchParams: Promise<{ toast?: string }>;
}) {
  const { id, taskId } = await params;
  const sp = await searchParams;
  const user = await requireUser();

  const access = await getProjectAccess(id, user);
  if (!access) notFound();

  const task = await prisma.task.findFirst({
    where: { id: taskId, projectId: id },
    include: {
      status: true,
      assignee: { select: { name: true, email: true, image: true } },
      owner: { select: { name: true, email: true, image: true } },
      tags: { include: { tag: true } },
      attachments: {
        orderBy: { createdAt: "asc" },
        include: { uploader: { select: { id: true, name: true, email: true } } },
      },
    },
  });
  if (!task) notFound();

  const canEdit = canModifyTask(
    access,
    { ownerId: task.ownerId, assigneeId: task.assigneeId },
    user.id,
  );
  const isOwner = access.isAdmin || access.role === "OWNER";
  const isDeleted = task.status.kind === "DELETED";
  // Deleted tasks are only visible to owners/admins.
  if (isDeleted && !isOwner) notFound();
  const canDelete = canDeleteTask(access, { ownerId: task.ownerId }, user.id) && !isDeleted;
  // Any EDITOR+ can take over a task they're not already assigned to.
  const canSelfAssign =
    atLeast(access.role, "EDITOR") && task.assigneeId !== user.id && !isDeleted;

  const [statuses, members, projectTags] = await Promise.all([
    canEdit
      ? prisma.workflowStatus.findMany({
          where: { projectId: id, kind: "NORMAL" }, // Deleted isn't a manual dropdown option
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
  const commentsResult = await getTaskComments(task.id);
  const threadedComments = commentsResult.comments ?? [];
  const totalCommentCount = threadedComments.reduce(
    (sum, n) => sum + 1 + n.replies.length,
    0,
  );

  const activities = await prisma.taskActivity.findMany({
    where: { taskId: task.id },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true, email: true, image: true } } },
  });

  const memberOptions = members.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    email: m.user.email,
  }));
  const ownerName = task.owner.name ?? task.owner.email ?? "Unknown";
  const assigneeName = task.assignee?.name ?? task.assignee?.email ?? null;
  return (
    <div className="w-full">
      <FlashToast type={sp.toast} />
      <Link
        href={`/projects/${id}`}
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Back to tasks
      </Link>

      {isDeleted && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-app px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <Trash2 className="h-4 w-4 shrink-0 text-muted" />
            <span className="font-medium text-ink">This task is in the Deleted column.</span>
            <span className="text-muted">Only owners can see it.</span>
          </div>
          <form action={restoreTask}>
            <input type="hidden" name="id" value={task.id} />
            <button
              type="submit"
              className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
            >
              <RotateCcw className="h-4 w-4" /> Restore task
            </button>
          </form>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {/* Details */}
        <section>
          <h2 className="mb-3 text-base font-semibold text-ink">Details</h2>
          <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            {/* People meta — visible at the top so it's clear who owns/handles this. */}
            <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-border pb-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted">
                  Created by
                </span>
                <Avatar src={task.owner.image} name={ownerName} size={24} />
                <span className="text-sm font-semibold text-ink">{ownerName}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted">
                  Assignee
                </span>
                {assigneeName ? (
                  <span className="flex items-center gap-1.5">
                    <Avatar src={task.assignee?.image} name={assigneeName} size={24} />
                    <span className="text-sm font-semibold text-ink">{assigneeName}</span>
                  </span>
                ) : (
                  <span className="text-sm text-muted">Unassigned</span>
                )}
                {canSelfAssign && (
                  <form action={assignToMe}>
                    <input type="hidden" name="id" value={task.id} />
                    <button
                      type="submit"
                      className="ml-1 flex h-7 items-center gap-1 rounded-lg border border-primary/40 px-2.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                    >
                      <UserPlus className="h-3.5 w-3.5" /> Assign to me
                    </button>
                  </form>
                )}
              </div>
            </div>
        {canEdit && !isDeleted ? (
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
            deleteAction={deleteTask}
            canDelete={canDelete}
          />
        ) : (
          <div className="space-y-4">
            <p className="font-semibold text-ink">{task.title}</p>
            {task.description ? (
              <div
                className="comment-html text-sm text-ink"
                dangerouslySetInnerHTML={{ __html: task.description }}
              />
            ) : (
              <p className="text-sm text-muted">No description</p>
            )}
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
            </div>
            {task.tags.length > 0 && (
              <TagChips tags={task.tags.map((tt) => ({ name: tt.tag.name, color: tt.tag.color }))} />
            )}
            {!canEdit && (
              <p className="text-xs text-muted">You have view-only access to this project.</p>
            )}
          </div>
        )}
          </div>

          {/* Files / attachments */}
          <div className="mt-4 rounded-xl border border-border bg-surface p-5 shadow-sm">
            <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink">
              <Paperclip className="h-4 w-4" /> Files
              <span className="font-normal text-muted">({task.attachments.length})</span>
            </h3>
            {task.attachments.length === 0 ? (
              <p className="text-xs text-muted">No files attached.</p>
            ) : (
              <ul className="space-y-1.5">
                {task.attachments.map((a) => {
                  const canRemove = canEdit || a.uploader.id === user.id;
                  return (
                    <li
                      key={a.id}
                      className="flex items-center gap-2 rounded-lg border border-border bg-app/50 px-3 py-2"
                    >
                      <a
                        href={`/api/attachments/${a.id}`}
                        className="flex min-w-0 flex-1 items-center gap-2 text-sm text-ink hover:text-primary"
                      >
                        <Download className="h-4 w-4 shrink-0 text-muted" />
                        <span className="truncate">{a.filename}</span>
                        <span className="shrink-0 text-xs text-muted">{formatBytes(a.size)}</span>
                      </a>
                      {canRemove && (
                        <form action={deleteTaskAttachment}>
                          <input type="hidden" name="id" value={a.id} />
                          <button
                            type="submit"
                            aria-label={`Remove ${a.filename}`}
                            className="flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-negative/10 hover:text-negative"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </form>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {canEdit && <TaskAttachmentUploader taskId={task.id} />}
          </div>
        </section>

        {/* Comments */}
        <section>
          <h2 className="mb-3 text-base font-semibold text-ink">
            Comments <span className="font-normal text-muted">({totalCommentCount})</span>
          </h2>
          <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            <CommentThread taskId={task.id} initialComments={threadedComments} />
          </div>
        </section>

        {/* Activity */}
        <section>
          <h2 className="mb-3 text-base font-semibold text-ink">Activity</h2>
          <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            <ActivityFeed activities={activities} />
          </div>
        </section>
      </div>
    </div>
  );
}
