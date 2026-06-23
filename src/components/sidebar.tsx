"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FolderKanban, Building2, Boxes } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, ready: true },
  { label: "Projects", href: "/projects", icon: FolderKanban, ready: true },
  { label: "Clients", href: "/clients", icon: Building2, ready: true },
  { label: "Products", href: "/products", icon: Boxes, ready: true },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface md:flex">
      <div className="flex h-14 items-center gap-2 border-b border-border px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">
          T
        </div>
        <span className="text-base font-bold text-ink">TaskTracker</span>
      </div>

      <nav className="flex flex-col gap-1 p-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          if (!item.ready) {
            return (
              <span
                key={item.label}
                className="flex cursor-default items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-muted/60"
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-[18px] w-[18px]" />
                  {item.label}
                </span>
                <span className="rounded bg-app px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                  soon
                </span>
              </span>
            );
          }
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-ink hover:bg-app",
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
