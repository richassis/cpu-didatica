"use client";

import { useEffect, useState } from "react";
import { Mail, Copy, Check } from "lucide-react";
import { FEEDBACK_EMAIL } from "@/lib/appConfig";
import { HTML_LANG, type Locale } from "@/lib/locale";
import { useLocale } from "@/lib/i18n";

const KINDS = [
  {
    id: "suggestion",
    label: "Sugestão",
    placeholder: "Uma ideia de melhoria: o que você gostaria que o simulador fizesse ou mostrasse?",
  },
  {
    id: "problem",
    label: "Problema",
    placeholder: "O que você fez, o que esperava que acontecesse e o que aconteceu de fato.",
  },
  {
    id: "praise",
    label: "Elogio",
    placeholder: "O que funcionou bem, o que ajudou a entender a CPU.",
  },
] as const;

type Kind = (typeof KINDS)[number];

/**
 * The `mailto:` the button opens. The browser and the date go below the
 * message: they help reproduce a problem, and nothing of the student's
 * program goes with them.
 */
function mailtoHref(kind: Kind, message: string, locale: Locale): string {
  const subject = `[Simulador CPU] ${kind.label}`;
  const context = [
    "—",
    `Navegador: ${typeof navigator !== "undefined" ? navigator.userAgent : "?"}`,
    `Data: ${new Date().toLocaleString(HTML_LANG[locale])}`,
  ].join("\n");
  const body = `${message.trim()}\n\n${context}`;
  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default function FeedbackTab() {
  const locale = useLocale();
  const [kindId, setKindId] = useState<Kind["id"]>("suggestion");
  const kind = KINDS.find((k) => k.id === kindId) ?? KINDS[0];
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
        <h3 className="t-node mb-1 text-fg">Sua opinião ajuda o simulador a melhorar</h3>
        <p className="text-small leading-relaxed text-fg-muted">
          Conte o que funcionou, o que confundiu e o que faltou. Escreva aqui e o simulador abre o
          seu programa de email com a mensagem pronta para enviar.
        </p>
      </div>

      <div className="space-y-3 rounded-lg border border-line p-4">
        <div role="radiogroup" aria-label="Tipo de feedback" className="flex flex-wrap gap-2">
          {KINDS.map((k) => {
            const selected = k.id === kindId;
            return (
              <button
                key={k.id}
                role="radio"
                aria-checked={selected}
                onClick={() => setKindId(k.id)}
                className={`h-8 rounded-lg border px-3 text-small transition-colors ${
                  selected
                    ? "border-st-active bg-st-active/10 text-fg"
                    : "border-line text-fg-muted hover:border-line-strong hover:text-fg"
                }`}
              >
                {k.label}
              </button>
            );
          })}
        </div>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={kind.placeholder}
          aria-label="Mensagem"
          rows={6}
          className="w-full resize-y rounded-lg border border-line bg-transparent px-3 py-2 text-small leading-relaxed text-fg placeholder:text-fg-faint focus:border-st-active focus:outline-none"
        />

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={empty ? undefined : mailtoHref(kind, message, locale)}
            aria-disabled={empty}
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg border border-st-active bg-st-active/10 px-3 text-small text-fg transition-colors ${
              empty ? "pointer-events-none opacity-50" : "hover:bg-st-active/20"
            }`}
          >
            <Mail size={14} strokeWidth={1.5} />
            Escrever email
          </a>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-small text-fg-muted">
          <span>Se o email não abrir, envie para</span>
          <span className="font-mono text-fg">{FEEDBACK_EMAIL}</span>
          <button
            onClick={copyAddress}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-line px-2 text-small text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
          >
            {copied ? <Check size={13} strokeWidth={1.5} /> : <Copy size={13} strokeWidth={1.5} />}
            {copied ? "Copiado" : "Copiar"}
          </button>
        </div>
      </div>

      <p className="text-micro leading-snug text-fg-faint">
        O email sai do seu próprio programa de email, e só quando você enviar: o simulador não
        manda nada sozinho. O código do seu programa não vai junto.
      </p>
    </div>
  );
}
