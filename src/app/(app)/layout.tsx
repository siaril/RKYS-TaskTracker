import { Sidebar } from "@/components/sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { UserMenu } from "@/components/user-menu";
import { WhatsNew } from "@/components/whats-new";
import { NotificationBell } from "@/components/notification-bell";
import { requireUser } from "@/lib/session";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";

  return (
    <div className="flex min-h-screen">
      <Sidebar isAdmin={isAdmin} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border bg-surface px-4 md:px-6">
          <div className="flex items-center gap-2">
            <MobileNav isAdmin={isAdmin} />
            <span className="text-sm font-semibold text-muted">Workspace</span>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <UserMenu
              name={user.name ?? "User"}
              email={user.email ?? ""}
              image={user.image ?? null}
            />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
      <WhatsNew />
    </div>
  );
}
