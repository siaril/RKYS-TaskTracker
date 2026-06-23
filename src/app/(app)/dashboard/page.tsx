import { requireUser } from "@/lib/session";

export default async function DashboardPage() {
  const user = await requireUser();
  const firstName = (user.name ?? "there").split(" ")[0];

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold text-ink">Hi {firstName} 👋</h1>
      <p className="mt-1 text-muted">
        Welcome to TaskTracker. This is the foundation — projects, boards, and
        tasks are coming in the next phases.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { title: "Projects", desc: "Group work by client and product." },
          { title: "Kanban boards", desc: "Track tasks through your workflow." },
          { title: "Team access", desc: "Control who sees which project." },
        ].map((card) => (
          <div
            key={card.title}
            className="rounded-xl border border-border bg-surface p-5 shadow-sm"
          >
            <h2 className="font-semibold text-ink">{card.title}</h2>
            <p className="mt-1 text-sm text-muted">{card.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
