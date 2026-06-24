"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { recordTaskAttachment } from "@/lib/actions/attachments";

type UploadResult = {
  storedName?: string;
  filename?: string;
  mimeType?: string;
  size?: number;
  error?: string;
};

export function TaskAttachmentUploader({ taskId }: { taskId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPick() {
    const file = inputRef.current?.files?.[0];
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      // The file body goes through /api/upload (no server-action size limit).
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as UploadResult;
      if (!res.ok || !data.storedName) {
        setError(data.error ?? "Upload failed.");
        return;
      }
      startTransition(async () => {
        const result = await recordTaskAttachment({
          taskId,
          storedName: data.storedName!,
          filename: data.filename ?? file.name,
          mimeType: data.mimeType ?? file.type,
          size: data.size ?? file.size,
        });
        if (result.error) {
          setError(result.error);
          return;
        }
        if (inputRef.current) inputRef.current.value = "";
        router.refresh();
      });
    } finally {
      setBusy(false);
    }
  }

  const working = busy || pending;

  return (
    <div className="mt-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          ref={inputRef}
          type="file"
          onChange={onPick}
          disabled={working}
          className="block w-full text-xs text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-app file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-border disabled:opacity-60"
        />
        {working && (
          <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted">
            <Upload className="h-4 w-4 animate-pulse" /> Uploading…
          </span>
        )}
      </div>
      {error && <p className="mt-1.5 text-xs text-negative">{error}</p>}
      <p className="mt-1 text-xs text-muted">Max 10 MB. Executables not allowed.</p>
    </div>
  );
}
