"use client";

import { useEffect } from "react";
import { Sun, Moon } from "lucide-react";
import { useThemeStore, applyThemeAttribute } from "@/lib/themeStore";

/**
 * Switches between the light and dark colour profiles. Also the place that
 * pushes the persisted choice onto <html> after hydration, so the whole app
 * repaints from the semantic tokens.
 */
export default function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  useEffect(() => {
    applyThemeAttribute(theme);
  }, [theme]);

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
