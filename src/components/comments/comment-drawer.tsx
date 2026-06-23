"use client";

import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { CommentEditor } from "@/components/comments/comment-editor";
import { getTaskComments, deleteComment } from "@/lib/actions/comments";
import type { CommentDTO } from "@/lib/comment-types";
import { formatDateTime } from "@/lib/format";

export function CommentDrawer({
  taskId,
  taskTitle,
  onClose,
}: {
  taskId: string;
  taskTitle: string;
  onClose: () => void;
}) {
  const [comments, setComments] = useState<CommentDTO[] | null>(null);

  const load = useCallback(() => {
    getTaskComments(taskId).then((res) => setComments(res.comments ?? []));
  }, [taskId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function remove(id: string) {
    const fd = new FormData();
    fd.set("id", id);
    await deleteComment(fd);
    load();
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/30"
      />
      <aside className="relative flex h-full w-full max-w-md flex-col bg-surface shadow-xl">
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <span className="truncate font-semibold text-ink">{taskTitle}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-app hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {comments === null ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : comments.length === 0 ? (
            <p className="text-sm text-muted">No comments yet. Start the discussion.</p>
          ) : (
            <ul className="space-y-4">
              {comments.map((c) => (
                <li key={c.id} className="flex gap-3">
                  <Avatar src={c.authorImage} name={c.authorName} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-ink">{c.authorName}</span>
                      <span className="text-xs text-muted">
                        {formatDateTime(new Date(c.createdAt))}
                      </span>
                      {c.canDelete && (
                        <button
                          type="button"
                          onClick={() => remove(c.id)}
                          className="ml-auto text-xs text-muted hover:text-negative"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                    <div
                      className="comment-html mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink"
                      dangerouslySetInnerHTML={{ __html: c.bodyHtml }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-border p-3">
          <CommentEditor taskId={taskId} onPosted={load} />
        </div>
      </aside>
    </div>
  );
}
