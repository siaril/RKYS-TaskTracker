"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import Mention from "@tiptap/extension-mention";
import { ReactRenderer } from "@tiptap/react";
import type { SuggestionProps, SuggestionKeyDownProps } from "@tiptap/suggestion";
import { Avatar } from "@/components/avatar";
import { cn } from "@/lib/utils";
import type { MentionItem } from "@/lib/mention-types";

type ListRef = { onKeyDown: (props: SuggestionKeyDownProps) => boolean };

// The autocomplete dropdown. Rendered into document.body by ReactRenderer and
// positioned under the caret, so it floats above drawers/dialogs.
const MentionList = forwardRef<ListRef, SuggestionProps<MentionItem>>(
  function MentionList(props, ref) {
    const [selected, setSelected] = useState(0);
    useEffect(() => setSelected(0), [props.items]);

    function choose(index: number) {
      const item = props.items[index];
      if (item) props.command({ id: item.id, label: item.label });
    }

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        const n = props.items.length;
        if (n === 0) return false;
        if (event.key === "ArrowUp") {
          setSelected((s) => (s + n - 1) % n);
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelected((s) => (s + 1) % n);
          return true;
        }
        if (event.key === "Enter") {
          choose(selected);
          return true;
        }
        return false;
      },
    }));

    if (props.items.length === 0) {
      return (
        <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-muted shadow-lg">
          No people found
        </div>
      );
    }

    return (
      <div className="max-h-60 w-56 overflow-y-auto rounded-lg border border-border bg-surface p-1 shadow-lg">
        {props.items.map((item, i) => (
          <button
            key={item.id}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              choose(i);
            }}
            onMouseEnter={() => setSelected(i)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-ink",
              i === selected ? "bg-app" : "hover:bg-app",
            )}
          >
            <Avatar src={item.image} name={item.label} size={22} />
            <span className="truncate">{item.label}</span>
          </button>
        ))}
      </div>
    );
  },
);

function place(el: HTMLElement, rect: DOMRect | null) {
  if (!rect) return;
  el.style.left = `${rect.left}px`;
  el.style.top = `${rect.bottom + 6}px`;
}

/** Build a Mention extension whose `@` autocomplete is fed by `fetchItems`.
 *  Stores `{ id, label }` and renders a `<span class="mention" data-id …>@Name</span>`
 *  (the default Mention markup), which the sanitizer is configured to keep. */
export function createMentionExtension(
  fetchItems: (query: string) => Promise<MentionItem[]>,
) {
  return Mention.configure({
    HTMLAttributes: { class: "mention" },
    suggestion: {
      items: ({ query }) => fetchItems(query),
      render: () => {
        let component: ReactRenderer<ListRef, SuggestionProps<MentionItem>>;
        let popup: HTMLDivElement | null = null;

        return {
          onStart: (props) => {
            component = new ReactRenderer(MentionList, {
              props,
              editor: props.editor,
            });
            popup = document.createElement("div");
            popup.style.position = "fixed";
            popup.style.zIndex = "9999";
            popup.appendChild(component.element);
            document.body.appendChild(popup);
            place(popup, props.clientRect?.() ?? null);
          },
          onUpdate: (props) => {
            component.updateProps(props);
            place(popup!, props.clientRect?.() ?? null);
          },
          onKeyDown: (props) => {
            if (props.event.key === "Escape") {
              popup?.remove();
              popup = null;
              return true;
            }
            return component.ref?.onKeyDown(props) ?? false;
          },
          onExit: () => {
            popup?.remove();
            popup = null;
            component?.destroy();
          },
        };
      },
    },
  });
}
