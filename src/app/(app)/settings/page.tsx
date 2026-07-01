import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { EmailNotificationsToggle } from "@/components/email-notifications-toggle";
import { WhatsAppSettings } from "@/components/whatsapp-settings";

export default async function SettingsPage() {
  const sessionUser = await requireUser();
  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { emailNotifications: true, phone: true, whatsappNotifications: true },
  });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-xl font-semibold text-ink">Settings</h1>
      <p className="mb-6 text-sm text-muted">Manage your personal preferences.</p>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold text-ink">Notifications</h2>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-ink">Email notifications</p>
            <p className="mt-0.5 text-sm text-muted">
              Get a periodic email summarizing new notifications — when you&apos;re assigned a
              task, @mentioned, or someone comments on a task you&apos;re assigned to or created.
            </p>
          </div>
          <EmailNotificationsToggle initial={user?.emailNotifications ?? true} />
        </div>

        <div className="my-5 border-t border-border" />

        <WhatsAppSettings
          initialPhone={user?.phone ?? ""}
          initialEnabled={user?.whatsappNotifications ?? false}
        />
      </section>
    </div>
  );
}
