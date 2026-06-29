# Plan — Theme (Dark Mode)

> **For the implementing agent:** Read [`HANDOFF.md`](HANDOFF.md) first — repo
> architecture, coding patterns, git/branch workflow, the verification standard, and the
> memory/OOM safety rules. Also [`CLAUDE.md`](CLAUDE.md) (run + secrets).

## Goal
Add a dark mode toggle to the TaskTracker that lets users switch between light and dark
themes from the header. The preference persists per-user across sessions and devices.

## Design decisions (confirmed)
- **Toggle placement:** header (next to `NotificationBell`) — one click, instant feedback
- **Dark colors:** invert the luminance of the existing monday.com-inspired light tokens
- **Persistence:** `User.theme` field in DB + a `theme` cookie for SSR (no flash on load)
- **Strategy:** redefine CSS custom properties inside a `.dark` selector so existing
  components adapt automatically — no per-component `dark:` classes needed

## Why this approach works
Every component already uses CSS custom properties derived from `@theme` tokens:
`bg-app`, `text-ink`, `bg-surface`, `text-muted`, `border-border`, etc. (43 files, 200+
usages). By redefining those variables under `.dark`, the entire UI theme-swaps in one
place. The only thing we need to audit is hardcoded literal colors (`bg-white`,
`text-white`, raw hex) that don't use the token system.

---

## Step 1 — Schema: add `User.theme`

**File:** `prisma/schema.prisma` — add to the `User` model:

```diff
 model User {
   ...
   emailNotifications Boolean @default(true)
+  theme              String? @default("light")
   accounts      Account[]
   ...
 }
```

**Commands:**
```bash
npm run db:migrate -- --name add-user-theme
npm run db:generate
```

---

## Step 2 — Enable class-based dark mode + define dark tokens

**File:** `src/app/globals.css`

Add after `@import "tailwindcss";`:

```css
@custom-variant dark (&:where(.dark, .dark *));
```

Add after the `body { ... }` block:

```css
/* --- Dark theme ------------------------------------------------------------------ */
.dark {
  --color-app: #101113;
  --color-surface: #1c1d21;
  --color-ink: #e4e4e7;
  --color-muted: #a1a1aa;
  --color-border: #33353a;
  --color-border-strong: #43454a;

  /* Brand / accent — slightly desaturated for dark bg readability */
  --color-primary: #4c9aff;
  --color-primary-hover: #66aeff;
  --color-accent: #8888ff;

  /* Status colors — slightly brightened for dark bg contrast */
  --color-positive: #00c875;
  --color-working: #fdab3d;
  --color-negative: #e2445c;
  --color-neutral: #6b7280;
}
```

**Rationale for dark token values:**

| Token | Light | Dark | Notes |
|---|---|---|---|
| `app` | `#f6f7fb` | `#101113` | Main background — near-black, slightly lifted from pure black |
| `surface` | `#ffffff` | `#1c1d21` | Cards/panels — dark grey, high contrast against app |
| `ink` | `#323338` | `#e4e4e7` | Primary text — near-white with slight warmth |
| `muted` | `#676879` | `#a1a1aa` | Secondary text — lighter grey |
| `border` | `#e6e9ef` | `#33353a` | Hairline borders — dark grey |
| `border-strong` | `#d0d4e4` | `#43454a` | Stronger borders |
| `primary` | `#0073ea` | `#4c9aff` | Blue — brightened for dark bg readability |
| `primary-hover` | `#0060b9` | `#66aeff` | Hover state |
| `accent` | `#6161ff` | `#8888ff` | Purple — brightened |
| `positive` | `#00c875` | `#00c875` | Green — unchanged (legible on both) |
| `working` | `#fdab3d` | `#fdab3d` | Orange — unchanged |
| `negative` | `#e2445c` | `#e2445c` | Red — unchanged |
| `neutral` | `#c4c4c4` | `#6b7280` | Grey — darkened for muted status |

---

## Step 3 — Root layout: apply `.dark` class server-side

**File:** `src/app/layout.tsx`

Read the `theme` cookie and add `.dark` to `<html>` before paint:

```diff
+import { cookies } from "next/headers";

 export default function RootLayout({
   children,
 }: Readonly<{
   children: React.ReactNode;
 }>) {
+  const themeCookie = (await cookies()).get("theme")?.value;
   return (
-    <html lang="en" className={`${figtree.variable} h-full antialiased`}>
+    <html
+      lang="en"
+      className={`${figtree.variable} h-full antialiased${themeCookie === "dark" ? " dark" : ""}`}
+    >
       <body className="min-h-full">{children}</body>
     </html>
   );
 }
```

No client-side flash — the `<html>` class is set before the first byte hits the browser.

---

## Step 4 — Server action: `setTheme`

**File:** `src/lib/actions/auth.ts`

Add:

```ts
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export async function setTheme(formData: FormData) {
  const user = await requireUser();
  const theme = formData.get("theme") as string;
  if (theme !== "light" && theme !== "dark") return { error: "Invalid theme" };

  await prisma.user.update({ where: { id: user.id }, data: { theme } });
  (await cookies()).set("theme", theme, {
    path: "/",
    maxAge: 365 * 24 * 60 * 60, // 1 year
  });
  revalidatePath("/", "layout");
}
```

- Accepts `FormData` (works with plain `<form action={setTheme}>` — no client JS needed for the action itself).
- Persists to DB (follows user across devices).
- Sets a long-lived cookie (SSR immediate read, no DB query on every request).
- Revalidates the root layout so the `<html>` class updates for the next navigation.

---

## Step 5 — ThemeToggle component

**New file:** `src/components/theme-toggle.tsx`

```tsx
"use client";

import { useOptimistic, useTransition } from "react";
import { Sun, Moon } from "lucide-react";
import { setTheme } from "@/lib/actions/auth";

type Props = { initial: "light" | "dark" };

export function ThemeToggle({ initial }: Props) {
  const [, startTransition] = useTransition();
  const [theme, setOptimistic] = useOptimistic(initial);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    // Optimistic: flip the html class + state immediately
    document.documentElement.classList.toggle("dark", next === "dark");
    startTransition(() => setOptimistic(next));
    // Fire the server action for persistence (non-blocking)
    const fd = new FormData();
    fd.set("theme", next);
    setTheme(fd);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-app"
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "dark" ? (
        <Sun className="h-[18px] w-[18px] text-ink" />
      ) : (
        <Moon className="h-[18px] w-[18px] text-ink" />
      )}
    </button>
  );
}
```

- Uses `useOptimistic` for instant visual feedback (no waiting for the server).
- Sets `.dark` on `document.documentElement` eagerly, then persists in the background.
- Matches the `NotificationBell` and `UserMenu` button style (32px circle, icon, hover bg).

---

## Step 6 — Place in the header

**File:** `src/app/(app)/layout.tsx`

Read the theme from the DB (the user is already fetched by `requireUser()`):

```diff
-import { requireUser } from "@/lib/session";
+import { requireUser } from "@/lib/session";
+import { ThemeToggle } from "@/components/theme-toggle";

 export default async function AppLayout({ children }) {
   const user = await requireUser();
   const isAdmin = user.role === "ADMIN";

   return (
     <div className="flex min-h-screen">
       ...
         <header className="flex h-14 items-center justify-between ...">
           ...
           <div className="flex items-center gap-1">
+            <ThemeToggle initial={(user.theme as "light" | "dark") ?? "light"} />
             <NotificationBell />
             <UserMenu ... />
           </div>
```

The `user` from `requireUser()` already has the `theme` field (Prisma returns all columns by default from `findUnique` in the session lookup). We pass it to the client component as a prop.

---

## Step 7 — Audit hardcoded colors in components

Search for literal colors that would look wrong in dark mode:

```bash
# Hardcoded light backgrounds (will look bright islands in dark mode)
rg "bg-white|bg-gray-50|bg-gray-100" src/components/ --type tsx

# Hardcoded dark text (won't be visible on dark bg)
rg "text-black|text-gray-900|text-gray-800" src/components/ --type tsx

# Explicit hex colors
rg '#[0-9a-fA-F]{6}' src/components/ --type tsx
```

Known spots to check (from the 43 token-using files):

| File | Potential issue | Fix |
|---|---|---|
| `sidebar.tsx` | `bg-primary text-white` on RAD logo | `dark:text-ink` — or the logo looks fine as-is on the brand blue |
| `header` (in layout) | `bg-surface` + `text-muted` | Already tokenized — adapts automatically |
| `user-menu.tsx` | `bg-surface`, `text-ink`, `text-muted` | Already tokenized — no change needed |
| `notification-bell.tsx` | Check for hardcoded colors | Likely fine — uses `text-ink`, `border-border` |
| `whats-new.tsx` | Modal background | Check for hardcoded white/light colors |
| `kanban-board.tsx` | Column backgrounds, cards | Check for hardcoded light colors |
| `task-form.tsx` | Input backgrounds | Check for hardcoded `bg-white` |
| `signin/page.tsx` | Branded sign-in page | May need explicit dark styles |
| `activity-feed.tsx` | Activity item backgrounds | Check for hardcoded colors |
| `flash-toast.tsx` | Toast background | Check for hardcoded colors |

**Rule of thumb:** if a component uses `bg-white`, `bg-gray-50`, `text-black`, or raw
hex, convert to theme tokens: `bg-surface`, `text-ink`, `text-muted`. If a component
needs an explicit dark variant on a non-token class, use `dark:bg-zinc-800` etc.

---

## Step 8 — Verify

All three checks from HANDOFF §5:

1. **Typecheck:** `npx tsc --noEmit` (must be clean)
2. **DB smoke test:** write `prisma/smoke-theme.ts`:
   - Create a test user, call `setTheme({theme: "dark"})`
   - Verify `user.theme === "dark"` and the cookie is set
   - Call `setTheme({theme: "light"})`, verify reversion
   - Clean up (delete test user), then delete `smoke-theme.ts`
3. **Dev server probe:** `npm run dev`, visit `/dashboard`:
   - Verify light mode is the default (no dark class)
   - Click the header toggle → verify dark mode applies instantly
   - Navigate to `/projects`, `/settings`, the board — verify all pages look correct in dark mode
   - Refresh → verify theme persists (no flash)
   - Toggle back to light → verify reverts
   - Stop the server

---

## Files touched (summary)

| File | Action |
|---|---|
| `prisma/schema.prisma` | Add `User.theme` |
| `src/app/globals.css` | Add `@custom-variant dark`, `.dark { ... }` tokens |
| `src/app/layout.tsx` | Read cookie, apply `.dark` to `<html>` |
| `src/lib/actions/auth.ts` | Add `setTheme()` server action |
| `src/components/theme-toggle.tsx` | **New** — client toggle component |
| `src/app/(app)/layout.tsx` | Pass theme to `<ThemeToggle>`, render in header |
| Various components (~5-10) | Fix hardcoded colors found during audit (Step 7) |

---

## Risks / edge cases

| Risk | Mitigation |
|---|---|
| **Flash of wrong theme** on first load for new users | Cookie is set server-side by `setTheme()` before revalidate; root layout reads it before paint. No flash. |
| **User clears cookies** | Theme defaults to `"light"` (the Prisma default). User just sees light mode until they toggle. |
| **`requireUser()` doesn't return `theme`** | `prisma.user.findUnique` in session lookup returns all columns by default in Auth.js v5 with DB sessions. Verify in smoke test. If not, add `select: { theme: true }` to the session callback in `src/auth.ts`. |
| **`@custom-variant dark` not recognized in Tailwind v4** | Verified — Tailwind v4.0+ supports `@custom-variant`. If the installed version is older, fall back to `@variant dark (&:where(.dark, .dark *));` instead. |
| **Third-party embeds / iframes** not themed | Not in scope. The app has no third-party embeds. |
