"use client";

import { useRouter, usePathname } from "next/navigation";
import { ACTIVITY_CATEGORIES } from "@/lib/activity-filters";
import { TaskFilterCombobox } from "@/components/projects/task-filter-combobox";

// Two dropdowns (user + type) that drive the server query via the URL. Filtering resets
// to page 1 (we simply don't carry the page param when a filter changes).
export function ActivityFilters({
  members,
  tasks,
  selectedUser,
  selectedTask,
  selectedType,
}: {
  members: { id: string; name: string }[];
  tasks: { id: string; title: string }[];
  selectedUser: string;
  selectedTask: string;
  selectedType: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function go(next: { user?: string; task?: string; type?: string }) {
    const userVal = next.user ?? selectedUser;
    const taskVal = next.task ?? selectedTask;
    const typeVal = next.type ?? selectedType;
    const p = new URLSearchParams();
    if (userVal) p.set("user", userVal);
    if (taskVal) p.set("task", taskVal);
    if (typeVal && typeVal !== "all") p.set("type", typeVal);
    const qs = p.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const selectClass =
    "rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-ink focus:border-primary focus:outline-none";

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <label className="text-xs font-semibold text-muted">Filter:</label>
      <select
        value={selectedUser}
        onChange={(e) => go({ user: e.target.value })}
        className={selectClass}
        aria-label="Filter by user"
      >
        <option value="">All users</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      <TaskFilterCombobox
        tasks={tasks}
        value={selectedTask}
        onChange={(id) => go({ task: id })}
      />
      <select
        value={selectedType}
        onChange={(e) => go({ type: e.target.value })}
        className={selectClass}
        aria-label="Filter by activity type"
      >
        {ACTIVITY_CATEGORIES.map((c) => (
          <option key={c.key} value={c.key}>
            {c.label}
          </option>
        ))}
      </select>
    </div>
  );
}
