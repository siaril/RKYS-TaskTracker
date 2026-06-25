import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldCheck, Lock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getProjectAccess } from "@/lib/access";
import { ProjectTabs } from "@/components/projects/project-tabs";
import { CopyLinkButton } from "@/components/copy-link-button";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const project = await prisma.project.findUnique({
    where: { id },
    include: { client: true },
  });
  if (!project) notFound();

  const access = await getProjectAccess(id, user);
  if (!access) {
    // The project exists but the viewer isn't a member: show a friendly
    // "request access" page naming the owner(s) instead of a bare 404.
    const owners = await prisma.projectMember.findMany({
      where: { projectId: id, role: "OWNER" },
      select: { user: { select: { name: true, email: true } } },
    });
    const ownerNames = owners.map((o) => o.user.name ?? o.user.email ?? "an owner");
    return (
      <div className="w-full">
        <Link
          href="/projects"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" /> Back to projects
        </Link>
        <div className="mx-auto mt-6 max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-app">
            <Lock className="h-5 w-5 text-muted" />
          </div>
          <h1 className="text-lg font-bold text-ink">
            You don&apos;t have access to this project
          </h1>
          <p className="mt-2 text-sm text-muted">
            {ownerNames.length > 0 ? (
              <>
                Ask{" "}
                {ownerNames.map((name, i) => (
                  <span key={i}>
                    {i > 0 && (i === ownerNames.length - 1 ? " or " : ", ")}
                    <span className="font-semibold text-primary">@{name}</span>
                  </span>
                ))}{" "}
                to add you as a member.
              </>
            ) : (
              "Ask a project owner to add you as a member."
            )}
          </p>
        </div>
      </div>
    );
  }

  const roleLabel = access.isAdmin
    ? "Admin"
    : access.role.charAt(0) + access.role.slice(1).toLowerCase();

  return (
    <div className="w-full">
      <Link
        href="/projects"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Back to projects
      </Link>

      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-ink">{project.name}</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted">
            {project.client.name}
            <span className="inline-flex items-center gap-1 rounded-full bg-app px-2 py-0.5 text-xs font-semibold text-muted">
              <ShieldCheck className="h-3 w-3" />
              {roleLabel}
            </span>
          </p>
        </div>
        <CopyLinkButton path={`/projects/${id}`} className="mt-1 shrink-0" />
      </header>

      <ProjectTabs projectId={id} />

      {children}
    </div>
  );
}
