import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getProjectAccess } from "@/lib/access";
import { ProjectTabs } from "@/components/projects/project-tabs";

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
  if (!access) notFound(); // hide existence from non-members

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

      <header className="mb-4">
        <h1 className="text-2xl font-bold text-ink">{project.name}</h1>
        <p className="mt-1 flex items-center gap-2 text-sm text-muted">
          {project.client.name}
          <span className="inline-flex items-center gap-1 rounded-full bg-app px-2 py-0.5 text-xs font-semibold text-muted">
            <ShieldCheck className="h-3 w-3" />
            {roleLabel}
          </span>
        </p>
      </header>

      <ProjectTabs projectId={id} />

      {children}
    </div>
  );
}
