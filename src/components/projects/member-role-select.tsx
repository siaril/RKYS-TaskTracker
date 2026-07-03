"use client";

import { useRef } from "react";
import { SelectMenu } from "@/components/select-menu";
import type { ProjectRole } from "@/lib/access";

const ROLE_OPTIONS: { value: ProjectRole; label: string }[] = [
  { value: "OWNER", label: "Owner" },
  { value: "EDITOR", label: "Editor" },
  { value: "VIEWER", label: "Viewer" },
];

/** A role dropdown that submits its parent form on change (no Save button). */
export function MemberRoleSelect({
  defaultValue,
  disabled,
}: {
  defaultValue: ProjectRole;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref}>
      <SelectMenu
        name="role"
        ariaLabel="Member role"
        defaultValue={defaultValue}
        disabled={disabled}
        options={ROLE_OPTIONS}
        className="w-32"
        triggerClassName="h-8 text-xs font-medium"
        // Fires after the hidden input commits, so the form submits the new role.
        onChange={() => ref.current?.closest("form")?.requestSubmit()}
      />
    </div>
  );
}
