import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ProjectForm } from "@/components/projects/project-form";
import { updateProject, deleteProject } from "@/lib/actions/projects";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [project, clients, products] = await Promise.all([
    prisma.project.findUnique({
      where: { id },
      include: {
        client: true,
        createdBy: { select: { name: true, email: true } },
        products: { select: { productId: true } },
      },
    }),
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.product.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true },
    }),
  ]);

  if (!project) notFound();

  const owner = project.createdBy.name ?? project.createdBy.email ?? "Unknown";

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/projects"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Back to projects
      </Link>

      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">{project.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {project.client.name} · created by {owner}
          </p>
        </div>
        <form action={deleteProject}>
          <input type="hidden" name="id" value={project.id} />
          <button
            type="submit"
            className="flex h-9 items-center gap-1.5 rounded-lg border border-border-strong px-3 text-sm font-medium text-muted hover:border-negative hover:bg-negative/10 hover:text-negative"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <ProjectForm
          action={updateProject}
          clients={clients}
          products={products}
          defaults={{
            id: project.id,
            name: project.name,
            description: project.description ?? "",
            clientId: project.clientId,
            productIds: project.products.map((p) => p.productId),
          }}
          submitLabel="Save changes"
          cancelHref="/projects"
        />
      </div>
    </div>
  );
}
