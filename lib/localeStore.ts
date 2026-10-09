/**
 * localeStore.ts
 *
 * The interface language, persisted once the visitor picks one. Until then it
 * follows the browser (see `resolveLocale`). A `?lang=` in the URL counts as a
 * pick: it is stored and then dropped from the address bar, so a shared link
 * works once and a reload keeps the choice.
 *
 * The chosen language is written to `<html lang>`. The inline script in
 * app/layout.tsx does the same before first paint.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  LOCALE_STORAGE_KEY,
  applyLangAttribute,
  browserLanguages,
  resolveLocale,
  type Locale,
} from "./locale";

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      // Overwritten by the persisted choice, if there is one.
      locale: typeof window === "undefined" ? "pt" : resolveLocale("", null, browserLanguages()),
      setLocale: (locale) => set({ locale }),
    }),
    {
      name: LOCALE_STORAGE_KEY,
      partialize: (s) => ({ locale: s.locale }),
    },
  ),
);

if (typeof window !== "undefined") {
  const params = new URLSearchParams(window.location.search);
  if (params.has("lang")) {
    const fromUrl = resolveLocale(window.location.search, null, []);
    if (/^(pt|en)/i.test(params.get("lang") ?? "")) useLocaleStore.getState().setLocale(fromUrl);
    params.delete("lang");
    const query = params.toString();
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname + (query ? `?${query}` : "") + window.location.hash,
    );
  }

  applyLangAttribute(useLocaleStore.getState().locale);
  useLocaleStore.subscribe((state, prev) => {
    if (state.locale !== prev.locale) applyLangAttribute(state.locale);
  });
}
