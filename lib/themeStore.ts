/**
 * themeStore.ts
 *
 * Colour profile for the whole app: a dark profile (the original look) and a
 * light one, switched by a button like a phone's display setting.
 *
 * The chosen profile is written to `data-theme` on <html>. Every colour in the
 * app comes from a Tailwind v4 palette variable (`--color-gray-900`, …), and
 * `app/globals.css` redefines those variables under `[data-theme="light"]`, so
 * one attribute repaints the entire interface — no per-component work.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "dark" | "light";

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

/** Reflect the active profile onto <html> so the CSS overrides apply. */
export function applyThemeAttribute(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "dark",

      setTheme: (theme) => {
        applyThemeAttribute(theme);
        set({ theme });
      },

      toggleTheme: () => {
        get().setTheme(get().theme === "dark" ? "light" : "dark");
      },
    }),
    {
      name: "simulator-theme",
      onRehydrateStorage: () => (state) => {
        if (state) applyThemeAttribute(state.theme);
      },
    },
  ),
);
