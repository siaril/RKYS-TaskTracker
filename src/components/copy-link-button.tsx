"use client";

import { useState } from "react";
import { Link2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Copies an absolute link to the given app path (origin + path) to the
 *  clipboard — so people share the exact, full URL instead of hand-selecting it
 *  and dropping characters. Uses the current origin, so it works on whatever
 *  domain the user is on. */
export function CopyLinkButton({
  path,
  label = "Copy link",
  className,
}: {
  path: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.origin + path);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked (e.g. non-HTTPS) — silently ignore.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-border-strong px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:bg-app hover:text-ink",
        className,
      )}
      title="Copy a shareable link"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-positive" />
      ) : (
        <Link2 className="h-3.5 w-3.5" />
      )}
      {copied ? "Copied!" : label}
    </button>
  );
}
