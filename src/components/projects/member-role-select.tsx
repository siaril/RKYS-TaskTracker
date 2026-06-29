"use client";

import type { ProjectRole } from "@/lib/access";

const ROLES: ProjectRole[] = ["OWNER", "EDITOR", "VIEWER"];

/** A role dropdown that submits its parent form on change (no Save button). */
export function MemberRoleSelect({
  defaultValue,
  disabled,
}: {
  defaultValue: ProjectRole;
  disabled?: boolean;
}) {
  return (
    <select
      name="role"
      defaultValue={defaultValue}
      disabled={disabled}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
      className="h-8 rounded-lg border border-border-strong bg-surface px-2 text-xs font-medium text-ink outline-none focus:border-primary disabled:opacity-60"
    >
      {ROLES.map((r) => (
        <option key={r} value={r}>
          {r.charAt(0) + r.slice(1).toLowerCase()}
        </option>
      ))}
    </select>
  );
}
