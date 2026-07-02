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
  pointerWithin,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { CalendarDays, MessageCircle, ArrowLeftRight } from "lucide-react";
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
  canModify: boolean; // may this user drag/move this specific card?
};
type Status = { id: string; name: string; color: string; kind: "NORMAL" | "DELETED" };

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

  // Shared by drag (desktop) and the Move sheet (mobile): optimistically move a card
  // to another column and persist. Moving INTO Deleted is never allowed here (deletion
  // goes through the Delete button + confirmation); moving OUT of Deleted restores.
  function applyMove(taskId: string, to: string) {
    const from = columnOf(taskId);
    if (!from || !columns[to] || from === to) return;
    if (statuses.find((s) => s.id === to)?.kind === "DELETED") return;
    const task = columns[from].find((t) => t.id === taskId);
    if (!task) return;
    setColumns((prev) => ({
      ...prev,
      [from]: prev[from].filter((t) => t.id !== taskId),
      [to]: [...prev[to], task],
    }));
    void moveTask({ taskId, projectId, toStatusId: to });
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    applyMove(String(active.id), String(over.id));
  }

  const open = (taskId: string) => router.push(`/projects/${projectId}/tasks/${taskId}`);

  const board = (
    <div className="flex gap-3 overflow-x-auto pb-3">
      {statuses.map((s) => {
        const list = columns[s.id] ?? [];
        return (
          <Column key={s.id} status={s} count={list.length}>
            {list.map((t) =>
              canEdit && t.canModify ? (
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

  return (
    <>
      {/* Desktop (md+): horizontal drag-and-drop board. */}
      <div className="hidden md:block">
        {canEdit ? (
          <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveId(null)}
          >
            {board}
            <DragOverlay>
              {activeId ? <CardShell task={taskById(activeId)!} dragging /> : null}
            </DragOverlay>
          </DndContext>
        ) : (
          board
        )}
      </div>

      {/* Mobile (<md): one status at a time via tabs, tap a card's Move to change status. */}
      <div className="md:hidden">
        <MobileBoard
          statuses={statuses}
          columns={columns}
          canEdit={canEdit}
          onOpen={open}
          onComments={setOpenTask}
          onMove={applyMove}
        />
      </div>

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
        {status.kind === "DELETED" && (
          <span className="ml-auto text-[11px] text-muted">owners only · drag out to restore</span>
        )}
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
  onMove,
  dragging,
}: {
  task: BoardTask;
  onOpen?: () => void;
  onComments?: () => void;
  onMove?: () => void;
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
        <div className="flex items-center gap-2.5">
          {onMove && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onMove();
              }}
              aria-label="Move to another status"
              className="flex items-center gap-1 rounded text-xs font-medium text-muted hover:text-primary"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              Move
            </button>
          )}
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

// Mobile view: a tab per status (so only one column shows at a time on a narrow screen),
// with full-width cards and a tap-driven "Move" sheet instead of drag-and-drop.
function MobileBoard({
  statuses,
  columns,
  canEdit,
  onOpen,
  onComments,
  onMove,
}: {
  statuses: Status[];
  columns: Record<string, BoardTask[]>;
  canEdit: boolean;
  onOpen: (taskId: string) => void;
  onComments: (task: BoardTask) => void;
  onMove: (taskId: string, toStatusId: string) => void;
}) {
  const [activeId, setActiveId] = useState<string>(statuses[0]?.id ?? "");
  const [moveTarget, setMoveTarget] = useState<BoardTask | null>(null);

  const active = statuses.find((s) => s.id === activeId) ?? statuses[0];
  const list = active ? (columns[active.id] ?? []) : [];
  // Tasks can only be moved between regular columns (never into Deleted via the sheet).
  const moveTargets = statuses.filter((s) => s.kind === "NORMAL");

  return (
    <div>
      <div className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {statuses.map((s) => {
          const count = (columns[s.id] ?? []).length;
          const isActive = active?.id === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveId(s.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                isActive
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border-strong text-muted",
              )}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
              {s.name}
              <span className={cn("text-xs", isActive ? "text-primary" : "text-muted")}>{count}</span>
            </button>
          );
        })}
      </div>

      {active?.kind === "DELETED" && (
        <p className="mb-2 text-xs text-muted">Owners only · use Move to restore a task.</p>
      )}

      <div className="flex flex-col gap-2">
        {list.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border-strong p-8 text-center text-sm text-muted">
            No tasks in {active?.name ?? "this column"}.
          </p>
        ) : (
          list.map((t) => (
            <CardShell
              key={t.id}
              task={t}
              onOpen={() => onOpen(t.id)}
              onComments={() => onComments(t)}
              onMove={canEdit && t.canModify ? () => setMoveTarget(t) : undefined}
            />
          ))
        )}
      </div>

      {moveTarget && active && (
        <MoveSheet
          task={moveTarget}
          statuses={moveTargets}
          currentStatusId={active.id}
          onMove={(to) => {
            onMove(moveTarget.id, to);
            setMoveTarget(null);
          }}
          onClose={() => setMoveTarget(null)}
        />
      )}
    </div>
  );
}

function MoveSheet({
  task,
  statuses,
  currentStatusId,
  onMove,
  onClose,
}: {
  task: BoardTask;
  statuses: Status[];
  currentStatusId: string;
  onMove: (toStatusId: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative rounded-t-2xl bg-surface p-4 pb-6 shadow-xl">
        <p className="text-sm font-semibold text-ink">Move task</p>
        <p className="mb-3 truncate text-xs text-muted">{task.title}</p>
        <div className="flex flex-col gap-1">
          {statuses.map((s) => {
            const current = s.id === currentStatusId;
            return (
              <button
                key={s.id}
                type="button"
                disabled={current}
                onClick={() => onMove(s.id)}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-3 text-left text-sm transition-colors",
                  current ? "bg-app text-muted" : "text-ink hover:bg-app",
                )}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                {s.name}
                {current && <span className="ml-auto text-xs text-muted">Current</span>}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full rounded-lg border border-border py-2.5 text-sm font-medium text-muted"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
