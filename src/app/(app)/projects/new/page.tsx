import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ProjectForm } from "@/components/projects/project-form";
import { createProject } from "@/lib/actions/projects";
import { requireAdmin } from "@/lib/session";

export default async function NewProjectPage() {
  await requireAdmin();
  const [clients, products] = await Promise.all([
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.product.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/projects"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Back to projects
      </Link>

      <h1 className="mb-6 text-2xl font-bold text-ink">New project</h1>

      {clients.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border-strong p-6 text-sm text-muted">
          You need at least one client first. Add one on the{" "}
          <Link href="/clients" className="font-medium text-primary">
            Clients
          </Link>{" "}
          page.
        </p>
      ) : (
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <ProjectForm
            action={createProject}
            clients={clients}
            products={products}
            submitLabel="Create project"
            cancelHref="/projects"
          />
        </div>
      )}
    </div>
  );
}
