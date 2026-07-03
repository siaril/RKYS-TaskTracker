"use client";

import { useRouter, usePathname } from "next/navigation";
import { ACTIVITY_CATEGORIES } from "@/lib/activity-filters";
import { TaskFilterCombobox } from "@/components/projects/task-filter-combobox";
import { SelectMenu } from "@/components/select-menu";

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

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <label className="text-xs font-semibold text-muted">Filter:</label>
      <SelectMenu
        key={`user-${selectedUser}`}
        ariaLabel="Filter by user"
        defaultValue={selectedUser}
        onChange={(v) => go({ user: v })}
        className="w-44"
        triggerClassName="h-9"
        options={[
          { value: "", label: "All users" },
          ...members.map((m) => ({ value: m.id, label: m.name })),
        ]}
      />
      <TaskFilterCombobox
        tasks={tasks}
        value={selectedTask}
        onChange={(id) => go({ task: id })}
      />
      <SelectMenu
        key={`type-${selectedType}`}
        ariaLabel="Filter by activity type"
        defaultValue={selectedType}
        onChange={(v) => go({ type: v })}
        className="w-44"
        triggerClassName="h-9"
        options={ACTIVITY_CATEGORIES.map((c) => ({ value: c.key, label: c.label }))}
      />
    </div>
  );
}
