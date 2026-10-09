"use client";

import { Sun, Moon } from "lucide-react";
import { useThemeStore } from "@/lib/themeStore";

/**
 * Switches between the light and dark colour profiles. The store itself puts
 * the choice on <html> (see `themeStore.ts`).
 */
export default function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  const isDark = theme === "dark";
  const title = isDark ? "Mudar para o modo claro" : "Mudar para o modo escuro";

  return (
    <button
      onClick={toggleTheme}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-xs text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
      title={title}
      aria-label={title}
    >
      {isDark ? <Sun size={14} strokeWidth={1.5} /> : <Moon size={14} strokeWidth={1.5} />}
      {isDark ? "Claro" : "Escuro"}
    </button>
  );
}
