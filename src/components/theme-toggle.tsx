"use client";

import { useState } from "react";
import { Sun, Moon } from "lucide-react";
import { setTheme } from "@/lib/actions/auth";

type Props = { initial: "light" | "dark" };

export function ThemeToggle({ initial }: Props) {
  const [theme, setThemeState] = useState(initial);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    // Instant: flip the html class + state immediately
    document.documentElement.classList.toggle("dark", next === "dark");
    setThemeState(next);
    // Fire the server action for persistence (non-blocking)
    const fd = new FormData();
    fd.set("theme", next);
    setTheme(fd);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle dark mode"
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
