import Link from "next/link";
import { Pencil, Check, X, Shield, UserCheck, UserX } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { Avatar } from "@/components/avatar";
import { UserCreateForm } from "@/components/users/user-create-form";
import { FlashToast } from "@/components/flash-toast";
import { updateUser, setUserDisabled } from "@/lib/actions/users";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; error?: string; toast?: string }>;
}) {
  const me = await requireAdmin();
  const sp = await searchParams;
  const users = await prisma.user.findMany({
    orderBy: [{ disabled: "asc" }, { name: "asc" }],
    select: { id: true, name: true, email: true, image: true, role: true, disabled: true },
  });

  return (
    <div className="mx-auto max-w-4xl">
      <FlashToast type={sp.toast} />
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Users</h1>
        <p className="mt-1 text-sm text-muted">
          Who can sign in. Add people to the allowlist, set their role, or deactivate them.
        </p>
      </header>

      <UserCreateForm />

      {sp.error === "self-demote" && (
        <p className="mt-4 rounded-lg bg-negative/10 px-4 py-2 text-sm text-negative">
          You can&apos;t remove your own admin role.
        </p>
      )}
      {sp.error === "self-disable" && (
        <p className="mt-4 rounded-lg bg-negative/10 px-4 py-2 text-sm text-negative">
          You can&apos;t deactivate your own account.
        </p>
      )}

      <ul className="mt-6 space-y-2">
        {users.map((u) => {
          const editing = sp.edit === u.id;
          const isMe = u.id === me.id;
          const name = u.name ?? u.email ?? "User";
          return (
            <li
              key={u.id}
              className="rounded-xl border border-border bg-surface p-4 shadow-sm"
            >
              {editing ? (
                <form
                  action={updateUser}
                  className="flex flex-col gap-3 sm:flex-row sm:items-center"
                >
                  <input type="hidden" name="id" value={u.id} />
                  <input
                    name="name"
                    defaultValue={u.name ?? ""}
                    required
                    maxLength={100}
                    className="h-10 flex-1 rounded-lg border border-border-strong px-3 text-sm outline-none focus:border-primary"
                  />
                  <select
                    name="role"
                    defaultValue={u.role}
                    className="h-10 rounded-lg border border-border-strong px-3 text-sm outline-none focus:border-primary"
                  >
                    <option value="MEMBER">Member</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="flex h-10 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-white hover:bg-primary-hover"
                    >
                      <Check className="h-4 w-4" /> Save
                    </button>
                    <Link
                      href="/users"
                      className="flex h-10 items-center gap-1.5 rounded-lg border border-border-strong px-3 text-sm font-medium text-muted hover:bg-app"
                    >
                      <X className="h-4 w-4" /> Cancel
                    </Link>
                  </div>
                </form>
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar src={u.image} name={name} size={36} />
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 truncate font-semibold text-ink">
                        {name}
                        {isMe && (
                          <span className="rounded bg-app px-1.5 py-0.5 text-[11px] font-medium text-muted">
                            You
                          </span>
                        )}
                      </p>
                      <p className="truncate text-sm text-muted">{u.email}</p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {u.role === "ADMIN" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        <Shield className="h-3 w-3" /> Admin
                      </span>
                    )}
                    {u.disabled && (
                      <span className="rounded-full bg-negative/10 px-2 py-0.5 text-xs font-medium text-negative">
                        Disabled
                      </span>
                    )}

                    <Link
                      href={`/users?edit=${u.id}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-app hover:text-ink"
                      aria-label={`Edit ${name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Link>

                    {!isMe && (
                      <form action={setUserDisabled}>
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="disabled" value={(!u.disabled).toString()} />
                        {u.disabled ? (
                          <button
                            type="submit"
                            className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-positive hover:bg-positive/10"
                            aria-label={`Activate ${name}`}
                          >
                            <UserCheck className="h-4 w-4" /> Activate
                          </button>
                        ) : (
                          <button
                            type="submit"
                            className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-muted hover:bg-negative/10 hover:text-negative"
                            aria-label={`Deactivate ${name}`}
                          >
                            <UserX className="h-4 w-4" /> Deactivate
                          </button>
                        )}
                      </form>
                    )}
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
