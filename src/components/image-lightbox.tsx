"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

// Click any image inside rich-text content to view it full-size: .comment-html (rendered
// comments and read-only descriptions) and .comment-editor (the description edit form,
// which is how creators/editors see a task). One delegated listener covers every image on
// the page, including comments added after load. Backdrop / X / Escape close it.
export function ImageLightbox() {
  const [src, setSrc] = useState<string | null>(null);
  const [alt, setAlt] = useState("");

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName !== "IMG" || !target.closest(".comment-html, .comment-editor")) return;
      const img = target as HTMLImageElement;
      e.preventDefault();
      setSrc(img.currentSrc || img.src);
      setAlt(img.alt || "");
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    if (!src) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSrc(null);
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden"; // freeze background scroll
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [src]);

  if (!src) return null;

  return (
    <div
      onClick={() => setSrc(null)}
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
    >
      <button
        type="button"
        aria-label="Close image preview"
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
      >
        <X className="h-6 w-6" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
      />
    </div>
  );
}
