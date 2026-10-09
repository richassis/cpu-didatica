"use client";

import { ExternalLink } from "lucide-react";
import { CREDITS } from "@/lib/helpContent";
import { useT } from "@/lib/i18n";

export default function CreditsTab() {
  const t = useT().help.credits;
  return (
    <div className="mx-auto max-w-xl py-4 text-center">
      <div className="t-panel text-fg">{CREDITS.project}</div>
      <p className="mt-2 text-ui leading-relaxed text-fg-muted">{t.tagline}</p>

      <div className="mx-auto my-6 h-px w-16 bg-line" />

      <p className="text-ui leading-relaxed text-fg">
        {t.projectOf(CREDITS.universityShort)}
        <br />
        <span className="text-fg-muted">{CREDITS.university}</span>
        <br />
        <span className="text-fg-muted">{CREDITS.center}</span>
        <br />
        <span className="font-mono text-fg-faint">{CREDITS.year}</span>
      </p>

      <dl className="mx-auto mt-6 grid max-w-sm grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-left text-ui">
        <dt className="text-fg-faint">{t.professor}</dt>
        <dd className="text-fg">{CREDITS.professor}</dd>
        <dt className="text-fg-faint">{t.student}</dt>
        <dd className="text-fg">{CREDITS.student}</dd>
      </dl>

      <div className="mx-auto my-6 h-px w-16 bg-line" />

      <p className="text-ui leading-relaxed text-fg-muted">{t.openSource}</p>
      <a
        href={CREDITS.repository}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-small text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
      >
        {t.repository}
        <ExternalLink size={13} strokeWidth={1.5} />
      </a>
    </div>
  );
}
