"use client";

import { useEffect } from "react";
import { useThemeStore, applyThemeAttribute } from "@/lib/themeStore";

/**
 * Switches between the light and dark colour profiles, like a phone's display
 * setting. Also the place that pushes the persisted choice onto <html> after
 * hydration, so the whole app repaints from CSS variables.
 */
export default function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  useEffect(() => {
    applyThemeAttribute(theme);
  }, [theme]);

  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-gray-400 hover:text-white hover:bg-gray-700 border border-gray-700 hover:border-gray-600 transition-colors"
      title={isDark ? "Mudar para o modo claro" : "Mudar para o modo escuro"}
      aria-label={isDark ? "Mudar para o modo claro" : "Mudar para o modo escuro"}
    >
      {isDark ? (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="4" strokeWidth={2} />
          <path
            strokeLinecap="round"
            strokeWidth={2}
            d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
          />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
          />
        </svg>
      )}
      {isDark ? "Claro" : "Escuro"}
    </button>
  );
}
