"use client";

import { useActionState, useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { createClient, type FormState } from "@/lib/actions/clients";

export function ClientCreateForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createClient, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={action}
      className="rounded-xl border border-border bg-surface p-4 shadow-sm"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <input
          name="name"
          required
          maxLength={100}
          placeholder="Client name"
          className="h-10 flex-1 rounded-lg border border-border-strong px-3 text-sm outline-none focus:border-primary"
        />
        <input
          name="notes"
          maxLength={1000}
          placeholder="Notes (optional)"
          className="h-10 flex-1 rounded-lg border border-border-strong px-3 text-sm outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={pending}
          className="flex h-10 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          {pending ? "Adding…" : "Add client"}
        </button>
      </div>
      {state?.error && <p className="mt-2 text-sm text-negative">{state.error}</p>}
    </form>
  );
}
