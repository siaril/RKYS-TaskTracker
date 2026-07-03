"use client";

import { useState, useRef, useEffect } from "react";
import type { KeyboardEvent } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SelectOption = { value: string; label: string; color?: string };

// A theme-aware replacement for a native <select>. Native <select> dropdown popups
// can't be reliably dark-mode styled (Chrome on Windows ignores color-scheme and
// <option> colors for the popup), so we render our own.
//
// Two usage modes, combinable:
//  - Form field: pass `name` — the current value rides in a hidden input, so it
//    submits exactly like the <select> it replaces.
//  - Interactive: pass `onChange` — fired with the new value *after* it commits, so a
//    parent that auto-submits its form (via the hidden input) sees the updated value.
export function SelectMenu({
  name,
  options,
  defaultValue,
  onChange,
  placeholder = "Select…",
  ariaLabel,
  disabled,
  className,
  triggerClassName,
}: {
  name?: string;
  options: SelectOption[];
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string; // wrapper (width/layout, e.g. "w-full", "flex-1")
  triggerClassName?: string; // trigger button (height/text, e.g. "h-8 text-xs")
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  // Keep the latest onChange without making it an effect dependency (callers often pass
  // a fresh closure each render, which would otherwise refire the effect spuriously).
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // Notify the parent after the value commits (so a hidden-input form submit reads the
  // new value). Compared against the initial value so it never fires on mount — robust
  // to React StrictMode's double-invoked effects.
  const initial = useRef(value);
  useEffect(() => {
    if (value !== initial.current) onChangeRef.current?.(value);
  }, [value]);

  // Mirror a native <select>: reset to the default when the surrounding form resets.
  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const onReset = () => setValue(defaultValue ?? "");
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [defaultValue]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function toggle() {
    if (disabled) return;
    const next = !open;
    setOpen(next);
    if (next) setActive(Math.max(0, options.findIndex((o) => o.value === value)));
  }

  function pick(v: string) {
    setValue(v);
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (disabled) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      else setActive((a) => Math.min(a + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (open && options[active]) pick(options[active].value);
      else setOpen(true);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={ref} className={cn("relative", className)}>
      {name && <input type="hidden" name={name} value={value} />}
      <button
        type="button"
        onClick={toggle}
        onKeyDown={onKeyDown}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-border-strong bg-surface px-3 text-sm text-ink outline-none hover:bg-app focus:border-primary disabled:opacity-60",
          triggerClassName,
        )}
      >
        <span className={cn("flex items-center gap-2 truncate", !selected && "text-muted")}>
          {selected?.color && (
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: selected.color }}
            />
          )}
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted" />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute left-0 z-50 mt-1 max-h-64 w-full min-w-max overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-lg"
        >
          {options.map((o, i) => (
            <li key={o.value || "__empty"}>
              <button
                type="button"
                role="option"
                aria-selected={o.value === value}
                onClick={() => pick(o.value)}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink",
                  active === i && "bg-app",
                )}
              >
                {o.color && (
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: o.color }}
                  />
                )}
                <span className="flex-1 truncate">{o.label}</span>
                {o.value === value && <Check className="h-4 w-4 shrink-0 text-primary" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
