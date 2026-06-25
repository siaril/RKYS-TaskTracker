"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import type { FormState } from "@/lib/actions/tasks";
import { TagInput } from "@/components/tasks/tag-input";
import { RichTextEditor } from "@/components/rich-text-editor";

type Status = { id: string; name: string; color: string };
type Member = { id: string; name: string | null; email: string | null };
type Tag = { id: string; name: string; color: string };

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  projectId: string;
  statuses: Status[];
  members: Member[];
  tags: Tag[];
  defaults?: {
    id?: string;
    title?: string;
    description?: string;
    statusId?: string;
    priority?: string;
    assigneeId?: string;
    dueDate?: string; // yyyy-mm-dd
    tagIds?: string[];
  };
  submitLabel: string;
  cancelHref: string;
  deleteAction?: (formData: FormData) => void | Promise<void>;
};

const inputCls =
  "h-10 w-full rounded-lg border border-border-strong px-3 text-sm outline-none focus:border-primary";

export function TaskForm({
  action,
  projectId,
  statuses,
  members,
  tags,
  defaults,
  submitLabel,
  cancelHref,
  deleteAction,
}: Props) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  const selectedTags = new Set(defaults?.tagIds ?? []);
  const [description, setDescription] = useState(defaults?.description ?? "");

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="projectId" value={projectId} />
      {defaults?.id && <input type="hidden" name="id" value={defaults.id} />}

      <div>
        <label className="mb-1.5 block text-sm font-semibold text-ink">Title</label>
        <input
          name="title"
          required
          maxLength={200}
          defaultValue={defaults?.title ?? ""}
          placeholder="What needs to be done?"
          className={inputCls}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-semibold text-ink">Description</label>
        <input type="hidden" name="description" value={description} />
        <RichTextEditor
          initialHTML={defaults?.description ?? ""}
          onChange={setDescription}
          minHeightClass="min-h-[96px]"
          mention={{ projectId }}
        />
        <p className="mt-1 text-xs text-muted">Tip: paste a screenshot to add it inline.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-ink">Status</label>
          <select
            name="statusId"
            defaultValue={defaults?.statusId ?? statuses[0]?.id ?? ""}
            className={`${inputCls} bg-white`}
          >
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-ink">Priority</label>
          <select
            name="priority"
            defaultValue={defaults?.priority ?? "MEDIUM"}
            className={`${inputCls} bg-white`}
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-ink">Assignee</label>
          <select
            name="assigneeId"
            defaultValue={defaults?.assigneeId ?? ""}
            className={`${inputCls} bg-white`}
          >
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name ?? m.email}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-ink">Due date</label>
          <input
            type="date"
            name="dueDate"
            defaultValue={defaults?.dueDate ?? ""}
            className={`${inputCls} bg-white`}
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-semibold text-ink">Tags</label>
        <TagInput
          suggestions={tags.map((t) => ({ name: t.name, color: t.color }))}
          initial={tags
            .filter((t) => selectedTags.has(t.id))
            .map((t) => ({ name: t.name, color: t.color }))}
        />
      </div>

      {state?.error && <p className="text-sm text-negative">{state.error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="flex h-10 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        <Link
          href={cancelHref}
          className="flex h-10 items-center rounded-lg border border-border-strong px-5 text-sm font-medium text-muted hover:bg-app"
        >
          Cancel
        </Link>
        {defaults?.id && deleteAction && (
          <button
            type="submit"
            formAction={deleteAction}
            formNoValidate
            className="ml-auto flex h-10 items-center gap-1.5 rounded-lg bg-negative px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            <Trash2 className="h-4 w-4" /> Delete task
          </button>
        )}
      </div>
    </form>
  );
}
