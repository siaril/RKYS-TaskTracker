"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { RichTextEditor } from "@/components/rich-text-editor";
import { addComment } from "@/lib/actions/comments";

export function CommentEditor({
  taskId,
  parentId,
  initialHTML,
  onPosted,
  onCancel,
}: {
  taskId: string;
  parentId?: string | null;
  initialHTML?: string;
  onPosted?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [html, setHtml] = useState(initialHTML ?? "");
  const [resetKey, setResetKey] = useState(0);

  function submit() {
    setError(null);
    const body = html;
    startTransition(async () => {
      const res = await addComment({ taskId, bodyHtml: body, parentId });
      if (res.error) {
        setError(res.error);
        return;
      }
      setHtml("");
      setResetKey((k) => k + 1);
      if (onPosted) onPosted();
      else router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <RichTextEditor
        key={resetKey}
        initialHTML={initialHTML}
        onChange={setHtml}
        withFileAttach
        onError={setError}
        mention={{ taskId }}
      />
      <div className="flex items-center justify-between gap-2">
        <span className={cn("text-xs", error ? "text-negative" : "text-muted")}>
          {error ?? "Tip: paste a screenshot, or use 📎 to attach a file."}
        </span>
        <div className="flex items-center gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex h-9 items-center rounded-lg px-3 text-sm font-medium text-muted hover:text-ink"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
          >
            {pending ? "Posting…" : parentId ? "Reply" : "Comment"}
          </button>
        </div>
      </div>
    </div>
  );
}