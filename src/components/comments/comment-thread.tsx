"use client";

import { useCallback, useEffect, useState } from "react";
import { Avatar } from "@/components/avatar";
import { CommentEditor } from "@/components/comments/comment-editor";
import { getTaskComments, deleteComment } from "@/lib/actions/comments";
import type { CommentDTO, CommentNode } from "@/lib/comment-types";
import { formatDateTime } from "@/lib/format";

export function CommentThread({
  taskId,
  initialComments,
}: {
  taskId: string;
  initialComments?: CommentNode[];
}) {
  const [comments, setComments] = useState<CommentNode[] | null>(
    initialComments ?? null,
  );

  const load = useCallback(() => {
    getTaskComments(taskId).then((res) => setComments(res.comments ?? []));
  }, [taskId]);

  useEffect(() => {
    if (!initialComments) load();
  }, [initialComments, load]);

  async function remove(id: string) {
    const fd = new FormData();
    fd.set("id", id);
    await deleteComment(fd);
    load();
  }

  return (
    <div className="space-y-4">
      {comments === null ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted">No comments yet. Start the discussion.</p>
      ) : (
        <ul className="space-y-4">
          {comments.map((node) => (
            <CommentItem
              key={node.id}
              node={node}
              onDelete={remove}
              onReplyPosted={load}
              taskId={taskId}
            />
          ))}
        </ul>
      )}

      <div className="border-t border-border pt-4">
        <CommentEditor taskId={taskId} onPosted={load} />
      </div>
    </div>
  );
}

function CommentItem({
  node,
  onDelete,
  onReplyPosted,
  taskId,
}: {
  node: CommentNode;
  onDelete: (id: string) => void;
  onReplyPosted: () => void;
  taskId: string;
}) {
  const [replying, setReplying] = useState(false);

  return (
    <li>
      {/* Top-level comment */}
      <div className="flex gap-3">
        <Avatar src={node.authorImage} name={node.authorName} size={32} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-ink">{node.authorName}</span>
            <span className="text-xs text-muted">
              {formatDateTime(new Date(node.createdAt))}
            </span>
            {node.canDelete && (
              <button
                type="button"
                onClick={() => onDelete(node.id)}
                className="ml-auto text-xs text-muted hover:text-negative"
              >
                Delete
              </button>
            )}
          </div>
          <div
            className="comment-html mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink"
            dangerouslySetInnerHTML={{ __html: node.bodyHtml }}
          />
          <button
            type="button"
            onClick={() => setReplying(!replying)}
            className="mt-1 text-xs font-medium text-muted hover:text-ink"
          >
            {replying ? "Cancel" : "Reply"}
          </button>
        </div>
      </div>

      {/* Inline reply editor */}
      {replying && (
        <div className="ml-11 mt-2">
          <CommentEditor
            taskId={taskId}
            parentId={node.id}
            onPosted={() => {
              setReplying(false);
              onReplyPosted();
            }}
            onCancel={() => setReplying(false)}
          />
        </div>
      )}

      {/* Replies (indented, left-bordered). Single level: replying to a reply
          stays in this flat thread but pre-fills an @mention of its author. */}
      {node.replies.length > 0 && (
        <div className="ml-11 mt-2 border-l-2 border-border pl-4 space-y-3">
          {node.replies.map((reply) => (
            <ReplyItem
              key={reply.id}
              reply={reply}
              onDelete={onDelete}
              onReplyPosted={onReplyPosted}
              taskId={taskId}
            />
          ))}
        </div>
      )}
    </li>
  );
}

// Builds editor content that starts with a mention chip of `name`, so a reply to
// a reply clearly shows who it's directed at. Tiptap parses this span back into a
// real mention node; the sanitizer keeps it on save.
function mentionPrefill(id: string, name: string): string {
  const safe = escapeHtml(name);
  return `<p><span data-type="mention" class="mention" data-id="${escapeHtml(id)}" data-label="${safe}">@${safe}</span> </p>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function ReplyItem({
  reply,
  onDelete,
  onReplyPosted,
  taskId,
}: {
  reply: CommentDTO;
  onDelete: (id: string) => void;
  onReplyPosted: () => void;
  taskId: string;
}) {
  const [replying, setReplying] = useState(false);

  return (
    <div>
      <div className="flex gap-3">
        <Avatar src={reply.authorImage} name={reply.authorName} size={28} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-ink">{reply.authorName}</span>
            <span className="text-xs text-muted">
              {formatDateTime(new Date(reply.createdAt))}
            </span>
            {reply.canDelete && (
              <button
                type="button"
                onClick={() => onDelete(reply.id)}
                className="ml-auto text-xs text-muted hover:text-negative"
              >
                Delete
              </button>
            )}
          </div>
          <div
            className="comment-html mt-1 rounded-lg border border-border bg-app px-3 py-2 text-sm text-ink"
            dangerouslySetInnerHTML={{ __html: reply.bodyHtml }}
          />
          <button
            type="button"
            onClick={() => setReplying(!replying)}
            className="mt-1 text-xs font-medium text-muted hover:text-ink"
          >
            {replying ? "Cancel" : "Reply"}
          </button>
        </div>
      </div>

      {replying && (
        <div className="ml-11 mt-2">
          <CommentEditor
            taskId={taskId}
            parentId={reply.id}
            initialHTML={mentionPrefill(reply.authorId, reply.authorName)}
            onPosted={() => {
              setReplying(false);
              onReplyPosted();
            }}
            onCancel={() => setReplying(false)}
          />
        </div>
      )}
    </div>
  );
}