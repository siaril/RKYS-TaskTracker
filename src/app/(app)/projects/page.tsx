import Link from "next/link";
import { Plus, FolderKanban } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { ProductChips } from "@/components/projects/product-chips";
import { FlashToast } from "@/components/flash-toast";
import { requireUser } from "@/lib/session";
import { visibleProjectsWhere, isAdmin } from "@/lib/access";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string; toast?: string }>;
}) {
  const sp = await searchParams;
  const activeProduct = sp.product;
  const user = await requireUser();

  const [products, projects] = await Promise.all([
    prisma.product.findMany({ orderBy: { name: "asc" } }),
    prisma.project.findMany({
      where: {
        AND: [
          visibleProjectsWhere(user),
          activeProduct ? { products: { some: { productId: activeProduct } } } : {},
        ],
      },
      orderBy: { updatedAt: "desc" },
      include: {
        client: true,
        products: { include: { product: true } },
      },
    }),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <FlashToast type={sp.toast} />
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Projects</h1>
          <p className="mt-1 text-sm text-muted">
            Work grouped by client and the products it uses.
          </p>
        </div>
        {isAdmin(user) && (
          <Link
            href="/projects/new"
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
          >
            <Plus className="h-4 w-4" /> New project
          </Link>
        )}
      </header>

      {/* Filter by product */}
      <div className="mb-5 flex flex-wrap gap-2">
        <FilterChip href="/projects" label="All" active={!activeProduct} />
        {products.map((p) => (
          <FilterChip
            key={p.id}
            href={`/projects?product=${p.id}`}
            label={p.name}
            color={p.color}
            active={activeProduct === p.id}
          />
        ))}
      </div>

      {projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-strong p-10 text-center">
          <FolderKanban className="mx-auto h-8 w-8 text-muted" />
          <p className="mt-2 text-sm text-muted">
            {activeProduct
              ? "No projects use this product yet."
              : "No projects yet. Create your first one."}
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                href={`/projects/${project.id}`}
                className="block h-full rounded-xl border border-border bg-surface p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {project.client.name}
                </p>
                <h2 className="mt-0.5 font-semibold text-ink">{project.name}</h2>
                {project.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{project.description}</p>
                )}
                <div className="mt-3">
                  <ProductChips
                    products={project.products.map((pp) => ({
                      name: pp.product.name,
                      color: pp.product.color,
                    }))}
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterChip({
  href,
  label,
  color,
  active,
}: {
  href: string;
  label: string;
  color?: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border-strong text-muted hover:bg-app",
      )}
    >
      {color && <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />}
      {label}
    </Link>
  );
}
