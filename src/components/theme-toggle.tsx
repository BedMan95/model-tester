"use client";

import { useTheme } from "@/components/theme-provider";
import { Sun, Moon } from "@phosphor-icons/react";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4 text-amber-400" weight="regular" />
      ) : (
        <Moon className="h-4 w-4" weight="regular" />
      )}
    </button>
  );
}
