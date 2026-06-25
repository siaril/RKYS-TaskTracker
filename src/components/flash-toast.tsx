"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

const MESSAGES: Record<string, string> = {
  saved: "Changes saved",
  created: "Created successfully",
  deleted: "Task moved to Deleted",
  restored: "Task restored",
};

/**
 * Shows a brief success toast when the URL has a `?toast=` flag (e.g. after a
 * server action redirects here). Strips the flag from the URL so a refresh
 * won't re-show it, and auto-hides after a few seconds.
 */
export function FlashToast({ type }: { type?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (type && MESSAGES[type]) {
      setMessage(MESSAGES[type]);
      router.replace(pathname);
    }
  }, [type, pathname, router]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(t);
  }, [message]);

  if (!message) return null;

  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg bg-positive px-4 py-2.5 text-sm font-semibold text-white shadow-lg"
    >
      <CheckCircle2 className="h-4 w-4" />
      {message}
    </div>
  );
}
