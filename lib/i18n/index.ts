/**
 * i18n/index.ts
 *
 * The interface text, one catalog per language. `pt/` defines the shape: the
 * type `Messages` is taken from it, and `en/` is typed against it, so a key
 * missing from (or left over in) the English catalog fails `tsc`.
 *
 * An entry is a string, a function that builds the string from its parameters
 * (plurals, word order), or a function that returns JSX for prose with inline
 * markup.
 *
 * Every catalog is split by area, one file per area, the same files in each
 * language folder.
 */

import { useLocaleStore } from "@/lib/localeStore";
import type { Locale } from "@/lib/locale";
import { pt } from "./pt";
import { en } from "./en";

export type Messages = typeof pt;

export const MESSAGES: Readonly<Record<Locale, Messages>> = { pt, en };

/** The active language. */
export function useLocale(): Locale {
  return useLocaleStore((s) => s.locale);
}

/** The catalog of the active language. */
export function useT(): Messages {
  return MESSAGES[useLocale()];
}

/** The catalog of the active language, for code outside React. */
export function getMessages(): Messages {
  return MESSAGES[useLocaleStore.getState().locale];
}

/**
 * A component's label as shown: the one stored in the project file, unless the
 * catalog renames it in this language (`canvas.labels`, e.g. ULA → ALU).
 */
export function useDisplayLabel(label: string): string {
  return useT().canvas.labels[label] ?? label;
}
