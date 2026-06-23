"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function ProjectTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;
  const onSettings = pathname.startsWith(`${base}/settings`);

  const tabs = [
    { label: "Tasks", href: base, active: !onSettings },
    { label: "Settings", href: `${base}/settings`, active: onSettings },
  ];

  return (
    <nav className="mb-6 flex gap-1 border-b border-border">
      {tabs.map((t) => (
        <Link
          key={t.label}
          href={t.href}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-sm font-semibold transition-colors",
            t.active
              ? "border-primary text-primary"
              : "border-transparent text-muted hover:text-ink",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
