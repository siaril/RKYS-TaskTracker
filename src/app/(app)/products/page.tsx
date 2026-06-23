import Link from "next/link";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ProductCreateForm } from "@/components/products/product-create-form";
import { updateProduct, deleteProduct } from "@/lib/actions/products";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const products = await prisma.product.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Products</h1>
        <p className="mt-1 text-sm text-muted">
          The products your projects are built on.
        </p>
      </header>

      <ProductCreateForm />

      {sp.error === "name-taken" && (
        <p className="mt-4 rounded-lg bg-negative/10 px-4 py-2 text-sm text-negative">
          That name is already taken by another product.
        </p>
      )}

      <ul className="mt-6 space-y-2">
        {products.length === 0 && (
          <li className="rounded-xl border border-dashed border-border-strong p-8 text-center text-sm text-muted">
            No products yet. Add your first one above.
          </li>
        )}

        {products.map((product) => {
          const editing = sp.edit === product.id;
          return (
            <li
              key={product.id}
              className="rounded-xl border border-border bg-surface p-4 shadow-sm"
            >
              {editing ? (
                <form
                  action={updateProduct}
                  className="flex flex-col gap-3 sm:flex-row sm:items-center"
                >
                  <input type="hidden" name="id" value={product.id} />
                  <input
                    name="name"
                    defaultValue={product.name}
                    required
                    maxLength={100}
                    className="h-10 flex-1 rounded-lg border border-border-strong px-3 text-sm outline-none focus:border-primary"
                  />
                  <input
                    name="description"
                    defaultValue={product.description ?? ""}
                    maxLength={1000}
                    placeholder="Description (optional)"
                    className="h-10 flex-1 rounded-lg border border-border-strong px-3 text-sm outline-none focus:border-primary"
                  />
                  <input
                    type="color"
                    name="color"
                    defaultValue={product.color}
                    aria-label="Product color"
                    className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-border-strong bg-white p-1"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="flex h-10 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-white hover:bg-primary-hover"
                    >
                      <Check className="h-4 w-4" /> Save
                    </button>
                    <Link
                      href="/products"
                      className="flex h-10 items-center gap-1.5 rounded-lg border border-border-strong px-3 text-sm font-medium text-muted hover:bg-app"
                    >
                      <X className="h-4 w-4" /> Cancel
                    </Link>
                  </div>
                </form>
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="h-8 w-8 shrink-0 rounded-lg"
                      style={{ backgroundColor: product.color }}
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink">{product.name}</p>
                      {product.description && (
                        <p className="mt-0.5 truncate text-sm text-muted">
                          {product.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Link
                      href={`/products?edit=${product.id}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-app hover:text-ink"
                      aria-label={`Edit ${product.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Link>
                    <form action={deleteProduct}>
                      <input type="hidden" name="id" value={product.id} />
                      <button
                        type="submit"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-negative/10 hover:text-negative"
                        aria-label={`Delete ${product.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
