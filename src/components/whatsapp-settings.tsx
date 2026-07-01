"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { setPhone, setWhatsAppNotifications } from "@/lib/actions/settings";

export function WhatsAppSettings({
  initialPhone,
  initialEnabled,
}: {
  initialPhone: string;
  initialEnabled: boolean;
}) {
  const [phone, setPhoneInput] = useState(initialPhone);
  const [savedPhone, setSavedPhone] = useState(initialPhone);
  const [on, setOn] = useState(initialEnabled);
  const [saving, startSave] = useTransition();
  const [toggling, startToggle] = useTransition();

  const dirty = phone.trim() !== savedPhone;

  function savePhone() {
    startSave(async () => {
      try {
        const { phone: stored } = await setPhone(phone);
        setSavedPhone(stored);
        setPhoneInput(stored);
        if (!stored) setOn(false);
      } catch {
        /* keep the input as-is on failure */
      }
    });
  }

  function toggle() {
    if (!savedPhone) return;
    const next = !on;
    setOn(next); // optimistic
    startToggle(async () => {
      try {
        await setWhatsAppNotifications(next);
      } catch {
        setOn(!next);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-ink">WhatsApp notifications</p>
          <p className="mt-0.5 text-sm text-muted">
            Get a WhatsApp message for the same notifications. Add your number (with country
            code, e.g. <code>628123456789</code>) and turn it on.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="WhatsApp notifications"
          disabled={!savedPhone || toggling}
          onClick={toggle}
          className={cn(
            "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-40",
            on ? "bg-primary" : "bg-border",
          )}
        >
          <span
            className={cn(
              "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
              on ? "translate-x-5" : "translate-x-0.5",
            )}
          />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="tel"
          inputMode="numeric"
          value={phone}
          onChange={(e) => setPhoneInput(e.target.value)}
          placeholder="628123456789"
          aria-label="WhatsApp phone number"
          className="h-9 w-56 rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:border-primary focus:outline-none"
        />
        <button
          type="button"
          onClick={savePhone}
          disabled={!dirty || saving}
          className="h-9 rounded-lg border border-border px-3 text-sm font-medium text-ink transition-colors hover:bg-app disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {!savedPhone && (
          <span className="text-xs text-muted">Add a number to enable the toggle.</span>
        )}
      </div>
    </div>
  );
}
