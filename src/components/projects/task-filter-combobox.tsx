"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import type { KeyboardEvent } from "react";
import { Search, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// Searchable task picker for the activity filter — a native <select> is unusable when a
// project has hundreds of tasks. The full task list is passed in, so search is client-side.
export function TaskFilterCombobox({
  tasks,
  value,
  onChange,
}: {
  tasks: { id: string; title: string }[];
  value: string; // selected task id, or "" for all
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0); // 0 = "All tasks", 1..n = filtered[i-1]
  const ref = useRef<HTMLDivElement>(null);

  const selected = tasks.find((t) => t.id === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? tasks.filter((t) => t.title.toLowerCase().includes(q)) : tasks;
    return list.slice(0, 50); // cap rendered rows; refine with search
  }, [tasks, query]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      setQuery("");
      setActive(0);
    }
  }

  function pick(id: string) {
    setOpen(false);
    onChange(id);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active === 0) pick("");
      else if (filtered[active - 1]) pick(filtered[active - 1].id);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const rowClass = "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label="Filter by task"
        className="flex w-48 items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-ink hover:bg-app focus:border-primary focus:outline-none"
      >
        <span className={cn("truncate", !selected && "text-muted")}>
          {selected ? selected.title : "All tasks"}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted" />
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-1 w-72 overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-muted" />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Search tasks…"
              className="w-full bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
            />
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            <li>
              <button
                type="button"
                onClick={() => pick("")}
                className={cn(rowClass, active === 0 && "bg-app")}
              >
                <span className="flex-1 text-muted">All tasks</span>
                {value === "" && <Check className="h-4 w-4 text-primary" />}
              </button>
            </li>
            {filtered.map((t, i) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => pick(t.id)}
                  className={cn(rowClass, active === i + 1 && "bg-app")}
                >
                  <span className="flex-1 truncate">{t.title}</span>
                  {t.id === value && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-3 py-3 text-center text-sm text-muted">No tasks found</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
