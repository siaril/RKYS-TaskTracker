import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getProjectAccess } from "@/lib/access";
import { activityTypeWhere } from "@/lib/activity-filters";
import { cn } from "@/lib/utils";
import { ActivityFilters } from "@/components/projects/activity-filters";
import {
  ProjectActivityList,
  type ProjectActivityItem,
} from "@/components/projects/project-activity-list";
import type { Prisma } from "@/generated/prisma/client";

const PAGE_SIZE = 50;

export default async function ProjectActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ user?: string; type?: string; page?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();

  const access = await getProjectAccess(id, user);
  if (!access) notFound();
  const isOwner = access.isAdmin || access.role === "OWNER";

  const page = Math.max(1, Number(sp.page) || 1);
  const userId = sp.user || undefined;
  const typeKey = sp.type || "all";

  const members = await prisma.projectMember.findMany({
    where: { projectId: id },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: { user: { select: { id: true, name: true, email: true } } },
  });

  // Non-owners don't see activity for tasks currently in a Deleted column (mirrors the
  // board hiding deleted tasks from non-owners); owners/admins see everything.
  const where: Prisma.TaskActivityWhereInput = {
    task: { projectId: id, ...(isOwner ? {} : { status: { kind: "NORMAL" } }) },
    ...(userId ? { userId } : {}),
    ...activityTypeWhere(typeKey),
  };

  const rows = await prisma.taskActivity.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE + 1, // one extra row tells us whether a next page exists
    skip: (page - 1) * PAGE_SIZE,
    include: {
      user: { select: { name: true, email: true, image: true } },
      task: { select: { id: true, title: true } },
    },
  });

  const hasNext = rows.length > PAGE_SIZE;
  const items: ProjectActivityItem[] = rows.slice(0, PAGE_SIZE);

  const href = (p: number) => {
    const q = new URLSearchParams();
    if (userId) q.set("user", userId);
    if (typeKey !== "all") q.set("type", typeKey);
    if (p > 1) q.set("page", String(p));
    const qs = q.toString();
    return `/projects/${id}/activity${qs ? `?${qs}` : ""}`;
  };

  return (
    <div>
      <ActivityFilters
        members={members.map((m) => ({
          id: m.user.id,
          name: m.user.name ?? m.user.email ?? "User",
        }))}
        selectedUser={userId ?? ""}
        selectedType={typeKey}
      />

      <ProjectActivityList projectId={id} items={items} />

      {(page > 1 || hasNext) && (
        <div className="mt-6 flex items-center justify-between">
          <PagerLink href={href(page - 1)} disabled={page <= 1} dir="prev" />
          <span className="text-xs text-muted">Page {page}</span>
          <PagerLink href={href(page + 1)} disabled={!hasNext} dir="next" />
        </div>
      )}
    </div>
  );
}

function PagerLink({
  href,
  disabled,
  dir,
}: {
  href: string;
  disabled: boolean;
  dir: "prev" | "next";
}) {
  const className = cn(
    "inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm font-medium",
    disabled ? "pointer-events-none opacity-40" : "text-ink hover:bg-app",
  );
  if (disabled) {
    return (
      <span className={className} aria-disabled>
        {dir === "prev" ? <ChevronLeft className="h-4 w-4" /> : null}
        {dir === "prev" ? "Previous" : "Next"}
        {dir === "next" ? <ChevronRight className="h-4 w-4" /> : null}
      </span>
    );
  }
  return (
    <Link href={href} className={className}>
      {dir === "prev" ? <ChevronLeft className="h-4 w-4" /> : null}
      {dir === "prev" ? "Previous" : "Next"}
      {dir === "next" ? <ChevronRight className="h-4 w-4" /> : null}
    </Link>
  );
}
