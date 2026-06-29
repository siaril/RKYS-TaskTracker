"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { FormState } from "@/lib/actions/projects";

type Option = { id: string; name: string };
type ProductOption = { id: string; name: string; color: string };

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  clients: Option[];
  products: ProductOption[];
  defaults?: {
    id?: string;
    name?: string;
    description?: string;
    clientId?: string;
    productIds?: string[];
  };
  submitLabel: string;
  cancelHref: string;
};

export function ProjectForm({ action, clients, products, defaults, submitLabel, cancelHref }: Props) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  const selected = new Set(defaults?.productIds ?? []);

  return (
    <form action={formAction} className="space-y-5">
      {defaults?.id && <input type="hidden" name="id" value={defaults.id} />}

      <div>
        <label className="mb-1.5 block text-sm font-semibold text-ink">Name</label>
        <input
          name="name"
          required
          maxLength={150}
          defaultValue={defaults?.name ?? ""}
          placeholder="e.g. Erica rollout for PLN NP"
          className="h-10 w-full rounded-lg border border-border-strong px-3 text-sm outline-none focus:border-primary"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-semibold text-ink">Client</label>
        <select
          name="clientId"
          required
          defaultValue={defaults?.clientId ?? ""}
          className="h-10 w-full rounded-lg border border-border-strong bg-surface px-3 text-sm outline-none focus:border-primary"
        >
          <option value="" disabled>
            Choose a client…
          </option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-semibold text-ink">Description</label>
        <textarea
          name="description"
          rows={3}
          maxLength={2000}
          defaultValue={defaults?.description ?? ""}
          placeholder="Optional"
          className="w-full rounded-lg border border-border-strong px-3 py-2 text-sm outline-none focus:border-primary"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-semibold text-ink">Products used</label>
        {products.length === 0 ? (
          <p className="text-sm text-muted">
            No products yet — add some on the Products page first.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {products.map((p) => (
              <label
                key={p.id}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-border-strong px-3 py-2 text-sm font-medium text-ink hover:bg-app has-[:checked]:border-primary has-[:checked]:bg-primary/5"
              >
                <input
                  type="checkbox"
                  name="products"
                  value={p.id}
                  defaultChecked={selected.has(p.id)}
                  className="accent-primary"
                />
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: p.color }} />
                {p.name}
              </label>
            ))}
          </div>
        )}
      </div>

      {state?.error && <p className="text-sm text-negative">{state.error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="flex h-10 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        <Link
          href={cancelHref}
          className="flex h-10 items-center rounded-lg border border-border-strong px-5 text-sm font-medium text-muted hover:bg-app"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
