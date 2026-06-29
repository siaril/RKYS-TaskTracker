"use client";

import { useOptimistic, startTransition } from "react";
import { Sun, Moon } from "lucide-react";
import { setTheme } from "@/lib/actions/auth";

type Props = { initial: "light" | "dark" };

export function ThemeToggle({ initial }: Props) {
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
