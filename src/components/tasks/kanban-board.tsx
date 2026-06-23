"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { CalendarDays, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { PriorityBadge, type Priority } from "@/components/tasks/priority-badge";
import { TagChips } from "@/components/tasks/tag-chips";
import { Avatar } from "@/components/avatar";
import { CommentDrawer } from "@/components/comments/comment-drawer";
import { formatDueDate } from "@/lib/format";
import { moveTask } from "@/lib/actions/tasks";

export type BoardTask = {
  id: string;
  title: string;
  priority: Priority;
  dueDate: string | null; // ISO string
  assignee: { name: string; image: string | null } | null;
  tags: { name: string; color: string }[];
  commentCount: number;
};
type Status = { id: string; name: string; color: string };

export function KanbanBoard({
  projectId,
  statuses,
  tasksByStatus,
  canEdit,
}: {
  projectId: string;
  statuses: Status[];
  tasksByStatus: Record<string, BoardTask[]>;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [columns, setColumns] = useState(tasksByStatus);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openTask, setOpenTask] = useState<BoardTask | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
  );

  function columnOf(taskId: string) {
    return Object.keys(columns).find((sid) => columns[sid]?.some((t) => t.id === taskId));
  }
  function taskById(taskId: string): BoardTask | undefined {
    for (const sid of Object.keys(columns)) {
      const found = columns[sid]?.find((t) => t.id === taskId);
      if (found) return found;
    }
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const from = columnOf(String(active.id));
    const to = String(over.id);
    if (!from || !columns[to] || from === to) return;
    const task = columns[from].find((t) => t.id === active.id);
    if (!task) return;
    setColumns((prev) => ({
      ...prev,
      [from]: prev[from].filter((t) => t.id !== active.id),
      [to]: [...prev[to], task],
    }));
    void moveTask({ taskId: String(active.id), projectId, toStatusId: to });
  }

  const open = (taskId: string) => router.push(`/projects/${projectId}/tasks/${taskId}`);

  const board = (
    <div className="flex gap-3 overflow-x-auto pb-3">
      {statuses.map((s) => {
        const list = columns[s.id] ?? [];
        return (
          <Column key={s.id} status={s} count={list.length}>
            {list.map((t) =>
              canEdit ? (
                <DraggableCard
                  key={t.id}
                  task={t}
                  onOpen={() => open(t.id)}
                  onComments={() => setOpenTask(t)}
                />
              ) : (
                <CardShell
                  key={t.id}
                  task={t}
                  onOpen={() => open(t.id)}
                  onComments={() => setOpenTask(t)}
                />
              ),
            )}
          </Column>
        );
      })}
    </div>
  );

  const drawer = openTask ? (
    <CommentDrawer
      taskId={openTask.id}
      taskTitle={openTask.title}
      onClose={() => setOpenTask(null)}
    />
  ) : null;

  if (!canEdit) {
    return (
      <>
        {board}
        {drawer}
      </>
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        {board}
        <DragOverlay>
          {activeId ? <CardShell task={taskById(activeId)!} dragging /> : null}
        </DragOverlay>
      </DndContext>
      {drawer}
    </>
  );
}

function Column({
  status,
  count,
  children,
}: {
  status: Status;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id });
  return (
    <div
      className="flex w-72 shrink-0 flex-col gap-2 rounded-xl border border-border/70 p-2.5"
      style={{ backgroundColor: `${status.color}1f` }}
    >
      <div className="flex items-center gap-2 px-1">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: status.color }} />
        <span className="text-sm font-semibold text-ink">{status.name}</span>
        <span className="text-xs text-muted">{count}</span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-24 flex-col gap-2 rounded-lg p-1 transition-colors",
          isOver && "bg-black/5",
        )}
      >
        {children}
        {count === 0 && (
          <p className="px-2 py-6 text-center text-xs text-muted">No tasks</p>
        )}
      </div>
    </div>
  );
}

function DraggableCard({
  task,
  onOpen,
  onComments,
}: {
  task: BoardTask;
  onOpen: () => void;
  onComments: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onOpen}
      className="cursor-grab touch-none active:cursor-grabbing"
    >
      <CardShell task={task} onComments={onComments} />
    </div>
  );
}

function CardShell({
  task,
  onOpen,
  onComments,
  dragging,
}: {
  task: BoardTask;
  onOpen?: () => void;
  onComments?: () => void;
  dragging?: boolean;
}) {
  return (
    <div
      onClick={onOpen}
      className={cn(
        "rounded-lg border border-border bg-surface p-3 shadow-sm",
        onOpen && "cursor-pointer hover:shadow-md",
        dragging && "rotate-1 shadow-lg",
      )}
    >
      <p className="text-sm font-medium text-ink">{task.title}</p>
      {task.tags.length > 0 && (
        <div className="mt-1.5">
          <TagChips tags={task.tags} />
        </div>
      )}
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <PriorityBadge priority={task.priority} />
          {task.dueDate && (
            <span className="flex items-center gap-1 text-xs text-muted">
              <CalendarDays className="h-3 w-3" />
              {formatDueDate(new Date(task.dueDate))}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onComments?.();
            }}
            aria-label="Comments"
            className="flex items-center gap-1 rounded text-xs text-muted hover:text-primary"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            {task.commentCount > 0 && task.commentCount}
          </button>
          {task.assignee && <Avatar src={task.assignee.image} name={task.assignee.name} size={22} />}
        </div>
      </div>
    </div>
  );
}
