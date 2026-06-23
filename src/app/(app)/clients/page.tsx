import Link from "next/link";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ClientCreateForm } from "@/components/clients/client-create-form";
import { updateClient, deleteClient } from "@/lib/actions/clients";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const clients = await prisma.client.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Clients</h1>
        <p className="mt-1 text-sm text-muted">
          The organizations your projects belong to.
        </p>
      </header>

      <ClientCreateForm />

      {sp.error === "name-taken" && (
        <p className="mt-4 rounded-lg bg-negative/10 px-4 py-2 text-sm text-negative">
          That name is already taken by another client.
        </p>
      )}
      {sp.error === "in-use" && (
        <p className="mt-4 rounded-lg bg-negative/10 px-4 py-2 text-sm text-negative">
          That client can&apos;t be deleted while it still has projects.
        </p>
      )}

      <ul className="mt-6 space-y-2">
        {clients.length === 0 && (
          <li className="rounded-xl border border-dashed border-border-strong p-8 text-center text-sm text-muted">
            No clients yet. Add your first one above.
          </li>
        )}

        {clients.map((client) => {
          const editing = sp.edit === client.id;
          return (
            <li
              key={client.id}
              className="rounded-xl border border-border bg-surface p-4 shadow-sm"
            >
              {editing ? (
                <form
                  action={updateClient}
                  className="flex flex-col gap-3 sm:flex-row sm:items-center"
                >
                  <input type="hidden" name="id" value={client.id} />
                  <input
                    name="name"
                    defaultValue={client.name}
                    required
                    maxLength={100}
                    className="h-10 flex-1 rounded-lg border border-border-strong px-3 text-sm outline-none focus:border-primary"
                  />
                  <input
                    name="notes"
                    defaultValue={client.notes ?? ""}
                    maxLength={1000}
                    placeholder="Notes (optional)"
                    className="h-10 flex-1 rounded-lg border border-border-strong px-3 text-sm outline-none focus:border-primary"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="flex h-10 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-white hover:bg-primary-hover"
                    >
                      <Check className="h-4 w-4" /> Save
                    </button>
                    <Link
                      href="/clients"
                      className="flex h-10 items-center gap-1.5 rounded-lg border border-border-strong px-3 text-sm font-medium text-muted hover:bg-app"
                    >
                      <X className="h-4 w-4" /> Cancel
                    </Link>
                  </div>
                </form>
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{client.name}</p>
                    {client.notes && (
                      <p className="mt-0.5 truncate text-sm text-muted">{client.notes}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Link
                      href={`/clients?edit=${client.id}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-app hover:text-ink"
                      aria-label={`Edit ${client.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Link>
                    <form action={deleteClient}>
                      <input type="hidden" name="id" value={client.id} />
                      <button
                        type="submit"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-negative/10 hover:text-negative"
                        aria-label={`Delete ${client.name}`}
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
