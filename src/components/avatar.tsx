"use client";

import { useState } from "react";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Round avatar. Renders the image when available; on load failure (or when
 * there's no image) it falls back to locally-drawn initials — no external
 * avatar service, and Google profile images load reliably thanks to
 * referrerPolicy="no-referrer".
 */
export function Avatar({
  src,
  name,
  size = 32,
}: {
  src?: string | null;
  name: string;
  size?: number;
}) {
  const [errored, setErrored] = useState(false);
  const dim = { width: size, height: size };

  if (src && !errored) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={name}
        referrerPolicy="no-referrer"
        onError={() => setErrored(true)}
        className="shrink-0 rounded-full border border-border object-cover"
        style={dim}
      />
    );
  }

  return (
    <span
      aria-label={name}
      className="flex shrink-0 items-center justify-center rounded-full border border-border bg-primary/10 font-semibold text-primary"
      style={{ ...dim, fontSize: Math.round(size * 0.4) }}
    >
      {getInitials(name)}
    </span>
  );
}
