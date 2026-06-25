# Access control & permissions

How TaskTracker decides who can do what. Two independent dimensions — a **global
account role** and a **per-project role** — sit behind a **sign-in allowlist**.

Source of truth: [`src/lib/access.ts`](../src/lib/access.ts),
[`src/lib/session.ts`](../src/lib/session.ts), [`src/auth.ts`](../src/auth.ts).

## 1. Sign-in gate (who can log in)

Google sign-in only. The `signIn` callback in [`src/auth.ts`](../src/auth.ts) is an
**allowlist**: it rejects anyone whose email isn't already a `User` row, or whose
account is `disabled`. So only pre-seeded teammates get in, and deactivating a user
blocks them immediately. The session carries `user.id` and `user.role`.

## 2. The two role dimensions

**Global role** (`UserRole` on the user):
- **ADMIN** — superuser. `isAdmin()` is true; `requireAdmin()` 404s everyone else.
  Admins **bypass project membership** entirely.
- **MEMBER** — a normal user; capabilities depend on per-project roles.

**Project role** (`ProjectRole` via `ProjectMember`): **OWNER / EDITOR / VIEWER**,
ranked by `atLeast()` (VIEWER 1 < EDITOR 2 < OWNER 3).

**How project access resolves** (`getProjectAccess`):
- A global **ADMIN always gets OWNER-level** access to every project (`isAdmin: true`).
- Otherwise it returns the user's `ProjectMember` role, or **`null` if they're not a
  member** → the project 404s. You only see projects you belong to
  (`visibleProjectsWhere`); admins see all.

## 3. Capability matrix (within a project)

| Capability | VIEWER | EDITOR | OWNER | Global ADMIN |
|---|:--:|:--:|:--:|:--:|
| See project / board / tasks | ✓\* | ✓ | ✓ | ✓ (all projects) |
| Comment on tasks | ✓ | ✓ | ✓ | ✓ |
| Delete a comment | own | own | own | **any** comment |
| Create a task | ✗ | ✓ | ✓ | ✓ |
| Edit / drag-move a task | ✗ | **own or assigned** | any | any |
| Self-assign ("Assign to me") | ✗ | ✓ | ✓ | ✓ |
| Delete a task (→ Deleted col) | ✗ | **own (created) only** | any | any |
| See Deleted column / restore | ✗ | ✗ | ✓ | ✓ |
| Edit project details | ✗ | ✓ | ✓ | ✓ |
| Manage members (add/role/remove) | ✗ | ✗ | ✓ | ✓ |
| Manage workflow columns | ✗ | ✗ | ✓ | ✓ |
| Delete the project | ✗ | ✗ | ✓ | ✓ |

\* only if they're a member of that project.

## 4. Enforcement helpers (where each rule lives)

- **`canModifyTask`** — edit/move a task: admin/OWNER → any; EDITOR → tasks they
  **own or are assigned**; VIEWER → none. ([`tasks.ts`](../src/lib/actions/tasks.ts))
- **`canDeleteTask`** — stricter: admin/OWNER → any; EDITOR → **only tasks they
  created**; VIEWER → none.
- **`assignToMe`** — any EDITOR+ can take over a task (assign it to themselves), then
  they pass `canModifyTask` and can change its status.
- **Comments** — any member can comment; deleting a comment requires being its
  **author or a global admin**. ([`comments.ts`](../src/lib/actions/comments.ts))
- **`canManage` = `atLeast(OWNER)`** — members, workflow columns, project deletion.
  The system **Deleted** column is locked even for owners.
- **`atLeast(EDITOR)`** — create tasks and edit project details.

## 5. Admin-only areas (global, project-independent)

Gated by `requireAdmin()` / `isAdmin` and hidden from the nav via the `adminOnly`
flag ([`nav-items.ts`](../src/components/nav-items.ts)):
- **Clients** and **Products** management
- **Creating projects** (`createProject` + `/projects/new`)
- **User management** (`/users` — add/edit/deactivate the login allowlist)

## 6. Built-in safeguards

- A project must always keep **at least one owner** (can't remove/demote the last).
- An admin **can't deactivate or demote themselves**.
- **Deleted tasks** are invisible to non-owners everywhere (board, counts, dashboard)
  — enforced server-side, not just hidden in the UI.

## 7. About 404s on project URLs

Opening `/projects/<id>` runs two guards in
[`projects/[id]/layout.tsx`](../src/app/(app)/projects/[id]/layout.tsx):
1. **Project not found** → `notFound()` (404) for *everyone*, including admins.
2. **No access** (not a member, not admin) → `notFound()`, which deliberately
   **hides the project's existence** from non-members rather than saying "forbidden".

So if a **non-member** gets a 404, that's working as designed (share the project by
adding them as a member). If an **admin** gets a 404, it's guard #1 — the project ID
doesn't exist in that environment's database (deleted, or a URL from a different
deployment/DB).

**Mental model:** *Global ADMIN = god mode + the admin console; within a project,
OWNER runs it, EDITOR works tasks they own or are assigned (and can self-assign),
VIEWER reads and comments.*
