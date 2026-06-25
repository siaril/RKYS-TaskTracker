"use client";

import { useCallback, useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { APP_VERSION, RELEASES, latestRelease } from "@/lib/releases";

const SEEN_KEY = "tasktracker:lastSeenVersion";
const OPEN_EVENT = "tasktracker:open-whats-new";

/** Small "vX.Y.Z" button (for the sidebar). Clicking opens the What's new modal.
 *  Decoupled from the modal via a window event so they can live in different
 *  parts of the tree. */
export function WhatsNewBadge() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}
      className="flex items-center gap-1.5 text-xs font-medium text-muted transition-colors hover:text-primary"
      title="What's new"
    >
      <Sparkles className="h-3.5 w-3.5" />
      v{APP_VERSION}
    </button>
  );
}

/** The What's new modal + auto-popup. Render once in the app layout so it shows
 *  on every page and viewport. Auto-opens the first time a user loads a new
 *  version, then remembers it (localStorage). Also opens on the badge event. */
export function WhatsNew() {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => {
    setOpen(false);
    try {
      localStorage.setItem(SEEN_KEY, APP_VERSION);
    } catch {}
  }, []);

  // Auto-popup once per user per version.
  useEffect(() => {
    let lastSeen: string | null = null;
    try {
      lastSeen = localStorage.getItem(SEEN_KEY);
    } catch {}
    if (lastSeen !== APP_VERSION) setOpen(true);
  }, []);

  // Open from the sidebar badge.
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  // Escape to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open) return null;

  const older = RELEASES.slice(1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        onClick={close}
        className="absolute inset-0 bg-black/40"
      />
      <div className="relative flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-surface shadow-xl">
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <div className="flex items-center gap-2 text-base font-bold text-ink">
              <Sparkles className="h-5 w-5 text-primary" /> What&apos;s new
            </div>
            <p className="mt-0.5 text-xs text-muted">
              Version {latestRelease.version} · {formatDate(latestRelease.date)}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-app hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <ul className="space-y-2.5">
            {latestRelease.highlights.map((h, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-ink">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>{h}</span>
              </li>
            ))}
          </ul>

          {older.length > 0 && (
            <div className="mt-6 border-t border-border pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Earlier updates
              </p>
              <div className="space-y-3">
                {older.map((r) => (
                  <div key={r.version}>
                    <p className="text-xs font-semibold text-ink">
                      v{r.version}{" "}
                      <span className="font-normal text-muted">· {formatDate(r.date)}</span>
                    </p>
                    <ul className="mt-1 space-y-1">
                      {r.highlights.map((h, i) => (
                        <li key={i} className="text-xs text-muted">
                          • {h}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <footer className="border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={close}
            className="flex h-9 w-full items-center justify-center rounded-lg bg-primary text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
          >
            Got it
          </button>
        </footer>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
