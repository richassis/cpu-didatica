"use client";

import { LOCALES, LOCALE_NAMES, HTML_LANG } from "@/lib/locale";
import { useLocaleStore } from "@/lib/localeStore";
import { useT } from "@/lib/i18n";

/**
 * Switches the interface language. Each option is written in its own language,
 * never translated, so it can be found from either one.
 *
 * `compact` shows the two-letter codes, for the welcome dialog's corner; the
 * full names fill the Settings panel.
 */
export default function LanguagePicker({ compact = false }: { compact?: boolean }) {
  const t = useT().bar.settings;
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);

  return (
    <div role="group" aria-label={t.language} className="flex items-center gap-1">
      {LOCALES.map((l) => (
        <button
          key={l}
          lang={HTML_LANG[l]}
          onClick={() => setLocale(l)}
          aria-pressed={locale === l}
          title={LOCALE_NAMES[l].long}
          className={`rounded-lg border text-xs transition-colors ${compact ? "px-2 py-1" : "flex-1 px-2 py-1.5"} ${
            locale === l
              ? "border-st-active text-st-active"
              : "border-line text-fg-muted hover:border-line-strong hover:text-fg"
          }`}
        >
          {compact ? LOCALE_NAMES[l].short : LOCALE_NAMES[l].long}
        </button>
      ))}
    </div>
  );
}
