import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getProjectAccess, atLeast } from "@/lib/access";
import { TaskForm } from "@/components/tasks/task-form";
import { createTask } from "@/lib/actions/tasks";

export default async function NewTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const access = await getProjectAccess(id, user);
  if (!access || !atLeast(access.role, "EDITOR")) notFound();

  const [statuses, members] = await Promise.all([
    prisma.workflowStatus.findMany({
      where: { projectId: id },
      orderBy: { position: "asc" },
      select: { id: true, name: true, color: true },
    }),
    prisma.projectMember.findMany({
      where: { projectId: id },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
  ]);
  const memberOptions = members.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    email: m.user.email,
  }));

  return (
    <div>
      <Link
        href={`/projects/${id}`}
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Back to tasks
      </Link>
      <h2 className="mb-4 text-lg font-semibold text-ink">New task</h2>
      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <TaskForm
          action={createTask}
          projectId={id}
          statuses={statuses}
          members={memberOptions}
          submitLabel="Create task"
          cancelHref={`/projects/${id}`}
        />
      </div>
    </div>
  );
}
