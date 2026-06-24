"use client";

import { useActionState, useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { createUser, type FormState } from "@/lib/actions/users";

export function UserCreateForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createUser, undefined);
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
          placeholder="Full name"
          className="h-10 flex-1 rounded-lg border border-border-strong px-3 text-sm outline-none focus:border-primary"
        />
        <input
          name="email"
          type="email"
          required
          maxLength={200}
          placeholder="email@rekayasa.io"
          className="h-10 flex-1 rounded-lg border border-border-strong px-3 text-sm outline-none focus:border-primary"
        />
        <select
          name="role"
          defaultValue="MEMBER"
          className="h-10 rounded-lg border border-border-strong px-3 text-sm outline-none focus:border-primary"
        >
          <option value="MEMBER">Member</option>
          <option value="ADMIN">Admin</option>
        </select>
        <button
          type="submit"
          disabled={pending}
          className="flex h-10 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          {pending ? "Adding…" : "Add user"}
        </button>
      </div>
      {state?.error && <p className="mt-2 text-sm text-negative">{state.error}</p>}
    </form>
  );
}
