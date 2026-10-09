/**
 * locale.ts
 *
 * Interface language: Portuguese or English.
 *
 * Kept free of zustand and React so `app/layout.tsx` can import it: its inline
 * script decides the language before first paint with the same rule the store
 * uses (`resolveLocale`), and writes it as `<html lang>`.
 */

export type Locale = "pt" | "en";

export const LOCALES: readonly Locale[] = ["pt", "en"];

/** Where the chosen language is persisted (`localeStore`). */
export const LOCALE_STORAGE_KEY = "simulator-locale";

/**
 * Each language's own name, the way the language picker shows it: someone who
 * landed in the wrong language still recognises their own.
 */
export const LOCALE_NAMES: Readonly<Record<Locale, { short: string; long: string }>> = {
  pt: { short: "PT", long: "Português" },
  en: { short: "EN", long: "English" },
};

/** The `<html lang>` value for each language. */
export const HTML_LANG: Readonly<Record<Locale, string>> = { pt: "pt-BR", en: "en" };

/**
 * The language to show: `?lang=` in the URL, else the one the visitor chose,
 * else the first supported language the browser asks for, else English.
 *
 * Self-contained on purpose — `LOCALE_BOOT_SCRIPT` inlines its source, so it
 * may not reference anything outside its own body.
 */
export function resolveLocale(
  search: string,
  stored: string | null | undefined,
  languages: readonly string[],
): Locale {
  const pick = (value: string | null | undefined): Locale | null => {
    if (!value) return null;
    const v = value.toLowerCase();
    if (v === "pt" || v.indexOf("pt-") === 0) return "pt";
    if (v === "en" || v.indexOf("en-") === 0) return "en";
    return null;
  };
  const match = /[?&]lang=([^&#]*)/.exec(search);
  const fromUrl = match ? pick(decodeURIComponent(match[1])) : null;
  if (fromUrl) return fromUrl;
  const fromStorage = pick(stored);
  if (fromStorage) return fromStorage;
  for (let i = 0; i < languages.length; i++) {
    const fromBrowser = pick(languages[i]);
    if (fromBrowser) return fromBrowser;
  }
  return "en";
}

/** The browser's language list, oldest API as fallback. */
export function browserLanguages(): readonly string[] {
  if (typeof navigator === "undefined") return [];
  return navigator.languages?.length ? navigator.languages : [navigator.language];
}

/** Reflect the language onto <html>, for screen readers, hyphenation and CSS. */
export function applyLangAttribute(locale: Locale): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = HTML_LANG[locale];
}

/**
 * The inline <head> script's part: set `<html lang>` before first paint, from
 * the persisted store (`{ state: { locale } }`), the URL and the browser.
 */
export const LOCALE_BOOT_SCRIPT =
  `try{var lc=null;try{lc=JSON.parse(localStorage.getItem(${JSON.stringify(LOCALE_STORAGE_KEY)})||"{}").state.locale}catch(e){}` +
  `var ll=(${resolveLocale.toString()})(location.search,lc,navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language]);` +
  `document.documentElement.lang=${JSON.stringify(HTML_LANG)}[ll]}catch(e){}`;
