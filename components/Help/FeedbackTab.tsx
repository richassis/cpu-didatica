"use client";

import { useEffect, useState } from "react";
import { Mail, Copy, Check } from "lucide-react";
import { FEEDBACK_EMAIL } from "@/lib/appConfig";
import { HTML_LANG, type Locale } from "@/lib/locale";
import { useLocale, useT, type Messages } from "@/lib/i18n";

const KINDS = ["suggestion", "problem", "praise"] as const;

type Kind = (typeof KINDS)[number];

type FeedbackText = Messages["help"]["feedback"];

/**
 * The `mailto:` the button opens. The browser and the date go below the
 * message: they help reproduce a problem, and nothing of the student's
 * program goes with them.
 *
 * The subject's prefix is the same in every language: the inbox is filtered
 * by it.
 */
function mailtoHref(kind: Kind, message: string, locale: Locale, text: FeedbackText): string {
  const subject = `[Simulador CPU] ${text.kinds[kind].label}`;
  const context = [
    "—",
    `${text.context.browser}: ${typeof navigator !== "undefined" ? navigator.userAgent : "?"}`,
    `${text.context.date}: ${new Date().toLocaleString(HTML_LANG[locale])}`,
  ].join("\n");
  const body = `${message.trim()}\n\n${context}`;
  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default function FeedbackTab() {
  const locale = useLocale();
  const text = useT().help.feedback;
  const [kind, setKind] = useState<Kind>("suggestion");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const empty = message.trim() === "";

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(t);
  }, [copied]);

  const copyAddress = () => {
    navigator.clipboard?.writeText(FEEDBACK_EMAIL).then(
      () => setCopied(true),
      () => {},
    );
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="t-node mb-1 text-fg">{text.heading}</h3>
        <p className="text-small leading-relaxed text-fg-muted">{text.intro}</p>
      </div>

      <div className="space-y-3 rounded-lg border border-line p-4">
        <div role="radiogroup" aria-label={text.kindAria} className="flex flex-wrap gap-2">
          {KINDS.map((k) => {
            const selected = k === kind;
            return (
              <button
                key={k}
                role="radio"
                aria-checked={selected}
                onClick={() => setKind(k)}
                className={`h-8 rounded-lg border px-3 text-small transition-colors ${
                  selected
                    ? "border-st-active bg-st-active/10 text-fg"
                    : "border-line text-fg-muted hover:border-line-strong hover:text-fg"
                }`}
              >
                {text.kinds[k].label}
              </button>
            );
          })}
        </div>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={text.kinds[kind].placeholder}
          aria-label={text.messageAria}
          rows={6}
          className="w-full resize-y rounded-lg border border-line bg-transparent px-3 py-2 text-small leading-relaxed text-fg placeholder:text-fg-faint focus:border-st-active focus:outline-none"
        />

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={empty ? undefined : mailtoHref(kind, message, locale, text)}
            aria-disabled={empty}
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg border border-st-active bg-st-active/10 px-3 text-small text-fg transition-colors ${
              empty ? "pointer-events-none opacity-50" : "hover:bg-st-active/20"
            }`}
          >
            <Mail size={14} strokeWidth={1.5} />
            {text.writeEmail}
          </a>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-small text-fg-muted">
          <span>{text.fallback}</span>
          <span className="font-mono text-fg">{FEEDBACK_EMAIL}</span>
          <button
            onClick={copyAddress}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-line px-2 text-small text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
          >
            {copied ? <Check size={13} strokeWidth={1.5} /> : <Copy size={13} strokeWidth={1.5} />}
            {copied ? text.copied : text.copy}
          </button>
        </div>
      </div>

      <p className="text-micro leading-snug text-fg-faint">{text.privacy}</p>
    </div>
  );
}
