"use client";

import { useState } from "react";
import { X } from "lucide-react";

type TagOpt = { name: string; color: string };

/**
 * Chip-style tag editor. Type a name and press Enter (or comma) to add a chip;
 * click the × on a chip to remove it from the task. Existing project tags are
 * offered as autocomplete suggestions and reused by name. Selected tag names
 * are submitted as repeated hidden `tagNames` inputs.
 */
export function TagInput({
  suggestions,
  initial,
}: {
  suggestions: TagOpt[];
  initial: TagOpt[];
}) {
  const [chips, setChips] = useState<TagOpt[]>(initial);
  const [input, setInput] = useState("");

  function colorFor(name: string): string {
    return suggestions.find((s) => s.name.toLowerCase() === name.toLowerCase())?.color ?? "#0073ea";
  }

  function add(raw: string) {
    const name = raw.trim();
    if (!name) return;
    if (chips.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      setInput("");
      return;
    }
    // reuse the canonical name/color if it matches an existing tag
    const existing = suggestions.find((s) => s.name.toLowerCase() === name.toLowerCase());
    setChips([...chips, existing ?? { name, color: colorFor(name) }]);
    setInput("");
  }

  function remove(name: string) {
    setChips(chips.filter((c) => c.name !== name));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(input);
    } else if (e.key === "Backspace" && !input && chips.length > 0) {
      remove(chips[chips.length - 1].name);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border-strong p-1.5 focus-within:border-primary">
        {chips.map((c) => (
          <span
            key={c.name}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium"
            style={{ backgroundColor: `${c.color}22`, color: c.color }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c.color }} />
            {c.name}
            <button
              type="button"
              onClick={() => remove(c.name)}
              aria-label={`Remove ${c.name}`}
              className="ml-0.5 rounded-full hover:bg-black/10"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => add(input)}
          list="tag-suggestions"
          placeholder={chips.length === 0 ? "Type a tag, press Enter" : "Add another…"}
          className="h-7 min-w-[9rem] flex-1 bg-transparent px-1 text-sm outline-none"
        />
      </div>
      <datalist id="tag-suggestions">
        {suggestions.map((s) => (
          <option key={s.name} value={s.name} />
        ))}
      </datalist>

      {chips.map((c) => (
        <input key={c.name} type="hidden" name="tagNames" value={c.name} />
      ))}
      {/* Safety net: submit text typed but not yet turned into a chip (deduped server-side). */}
      {input.trim() && <input type="hidden" name="tagNames" value={input.trim()} />}
    </div>
  );
}
