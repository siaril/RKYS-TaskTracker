import { notFound } from "next/navigation";
import { Trash2, X } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getProjectAccess, atLeast } from "@/lib/access";
import { ProjectForm } from "@/components/projects/project-form";
import { ProductChips } from "@/components/projects/product-chips";
import { MemberRoleSelect } from "@/components/projects/member-role-select";
import { FlashToast } from "@/components/flash-toast";
import { Avatar } from "@/components/avatar";
import { updateProject, deleteProject } from "@/lib/actions/projects";
import { addMember, updateMemberRole, removeMember } from "@/lib/actions/members";

export default async function ProjectSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ toast?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      products: { include: { product: true } },
      members: {
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
        include: { user: { select: { id: true, name: true, email: true, image: true } } },
      },
    },
  });
  if (!project) notFound();

  const access = await getProjectAccess(id, user);
  if (!access) notFound();

  const canEdit = atLeast(access.role, "EDITOR");
  const canManage = atLeast(access.role, "OWNER");

  const memberUserIds = project.members.map((m) => m.userId);
  const [clients, products, addableUsers] = await Promise.all([
    canEdit
      ? prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })
      : Promise.resolve([]),
    canEdit
      ? prisma.product.findMany({
          orderBy: { name: "asc" },
          select: { id: true, name: true, color: true },
        })
      : Promise.resolve([]),
    canManage
      ? prisma.user.findMany({
          where: { id: { notIn: memberUserIds } },
          orderBy: { name: "asc" },
          select: { id: true, name: true, email: true },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <FlashToast type={sp.toast} />

      {sp.error === "last-owner" && (
        <p className="rounded-lg bg-negative/10 px-4 py-2 text-sm text-negative">
          A project must keep at least one owner.
        </p>
      )}

      {/* Details */}
      <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="mb-4 font-semibold text-ink">Project details</h2>
        {canEdit ? (
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
            cancelHref={`/projects/${project.id}`}
          />
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-ink">
              {project.description || <span className="text-muted">No description</span>}
            </p>
            <ProductChips
              products={project.products.map((pp) => ({
                name: pp.product.name,
                color: pp.product.color,
              }))}
            />
            <p className="text-xs text-muted">You have view-only access to this project.</p>
          </div>
        )}
      </section>

      {/* Members */}
      <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="mb-4 font-semibold text-ink">
          Members <span className="text-muted">({project.members.length})</span>
        </h2>

        <ul className="space-y-2">
          {project.members.map((m) => (
            <li key={m.userId} className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar src={m.user.image} name={m.user.name ?? m.user.email ?? "User"} size={32} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {m.user.name ?? m.user.email}
                    {m.userId === user.id && <span className="text-muted"> (you)</span>}
                  </p>
                  <p className="truncate text-xs text-muted">{m.user.email}</p>
                </div>
              </div>

              {canManage ? (
                <div className="flex shrink-0 items-center gap-2">
                  <form action={updateMemberRole}>
                    <input type="hidden" name="projectId" value={project.id} />
                    <input type="hidden" name="userId" value={m.userId} />
                    <MemberRoleSelect defaultValue={m.role} />
                  </form>
                  <form action={removeMember}>
                    <input type="hidden" name="projectId" value={project.id} />
                    <input type="hidden" name="userId" value={m.userId} />
                    <button
                      type="submit"
                      aria-label="Remove member"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-negative/10 hover:text-negative"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </form>
                </div>
              ) : (
                <span className="shrink-0 rounded-full bg-app px-2.5 py-1 text-xs font-medium text-muted">
                  {m.role.charAt(0) + m.role.slice(1).toLowerCase()}
                </span>
              )}
            </li>
          ))}
        </ul>

        {canManage && (
          <div className="mt-4 border-t border-border pt-4">
            {addableUsers.length === 0 ? (
              <p className="text-sm text-muted">
                Everyone with an account is already a member. People appear here once they sign in
                for the first time.
              </p>
            ) : (
              <form action={addMember} className="flex flex-col gap-2 sm:flex-row">
                <input type="hidden" name="projectId" value={project.id} />
                <select
                  name="userId"
                  required
                  defaultValue=""
                  className="h-10 flex-1 rounded-lg border border-border-strong bg-white px-3 text-sm outline-none focus:border-primary"
                >
                  <option value="" disabled>
                    Add a person…
                  </option>
                  {addableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name ?? u.email}
                    </option>
                  ))}
                </select>
                <select
                  name="role"
                  defaultValue="EDITOR"
                  className="h-10 rounded-lg border border-border-strong bg-white px-3 text-sm outline-none focus:border-primary"
                >
                  <option value="OWNER">Owner</option>
                  <option value="EDITOR">Editor</option>
                  <option value="VIEWER">Viewer</option>
                </select>
                <button
                  type="submit"
                  className="flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover"
                >
                  Add
                </button>
              </form>
            )}
          </div>
        )}
      </section>

      {/* Danger zone */}
      {canManage && (
        <section className="rounded-xl border border-negative/30 bg-surface p-6 shadow-sm">
          <h2 className="font-semibold text-ink">Delete project</h2>
          <p className="mt-1 mb-3 text-sm text-muted">
            Permanently removes this project and all its tasks. This can&apos;t be undone.
          </p>
          <form action={deleteProject}>
            <input type="hidden" name="id" value={project.id} />
            <button
              type="submit"
              className="flex h-9 items-center gap-1.5 rounded-lg border border-negative/40 px-3 text-sm font-medium text-negative hover:bg-negative/10"
            >
              <Trash2 className="h-4 w-4" /> Delete project
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
