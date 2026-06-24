"use client";

import { useActionState, useEffect, useRef } from "react";
import { Upload } from "lucide-react";
import { addTaskAttachment, type AttachmentState } from "@/lib/actions/attachments";

export function TaskAttachmentUploader({ taskId }: { taskId: string }) {
  const [state, action, pending] = useActionState<AttachmentState, FormData>(
    addTaskAttachment,
    undefined,
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Reset the file input after a successful (non-error) submit.
  useEffect(() => {
    if (state && !state.error) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="mt-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input type="hidden" name="taskId" value={taskId} />
        <input
          type="file"
          name="file"
          required
          className="block w-full text-xs text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-app file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-border"
        />
        <button
          type="submit"
          disabled={pending}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
        >
          <Upload className="h-4 w-4" /> {pending ? "Uploading…" : "Attach"}
        </button>
      </div>
      {state?.error && <p className="mt-1.5 text-xs text-negative">{state.error}</p>}
      <p className="mt-1 text-xs text-muted">Max 10 MB. Executables not allowed.</p>
    </form>
  );
}
