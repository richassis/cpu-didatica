"use client";

import Legend from "@/components/ProgramMode/Legend";
import { PRESET_PROGRAMS } from "@/lib/presetPrograms";
import { useProgramDataStore } from "@/lib/programDataStore";
import { useExecutionStore } from "@/lib/executionStore";
import { useOnboardingStore } from "@/lib/onboardingStore";
import { useLocale, useT } from "@/lib/i18n";

/** The same two values, 1 and −1, in each notation a 16-bit variable accepts. */
const NUMBER_FORMATS = [
  ["decimal", "1", "-1"],
  ["hexadecimal", "0x0001", "0xFFFF"],
  ["binary", "0b0000000000000001", "0b1111111111111111"],
] as const;

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line font-mono text-small text-fg-muted">
        {n}
      </span>
      <div className="min-w-0">
        <div className="t-node text-fg">{title}</div>
        <p className="mt-0.5 text-ui leading-relaxed text-fg-muted">{children}</p>
      </div>
    </li>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="shrink-0 rounded border border-line px-1.5 py-0.5 font-mono text-caption text-fg-muted">
      {children}
    </kbd>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return <h3 className="t-node mb-2 text-fg">{children}</h3>;
}

export default function GuideTab({ onClose }: { onClose: () => void }) {
  const locale = useLocale();
  const setAssemblySource = useProgramDataStore((s) => s.setAssemblySource);
  const isRunning = useProgramDataStore((s) => s.isRunning);
  const isTimelineActive = useExecutionStore((s) => s.isTimelineActive);
  const locked = isRunning || isTimelineActive;
  const startTour = useOnboardingStore((s) => s.startTour);
  const openWelcome = useOnboardingStore((s) => s.openWelcome);

  const t = useT().help;
  const g = t.guide;
  const steps = g.howTo.steps;
  const asm = g.assembly;

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap gap-2">
        <button
          onClick={() => {
            onClose();
            startTour();
          }}
          className="h-8 rounded-lg border border-st-active bg-st-active/10 px-3 text-small text-fg transition-colors hover:bg-st-active/20"
        >
          {g.replayTour}
        </button>
        <button
          onClick={() => {
            onClose();
            openWelcome();
          }}
          className="h-8 rounded-lg border border-line px-3 text-small text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
        >
          {g.replayWelcome}
        </button>
      </section>

      <section>
        <Heading>{g.howTo.heading}</Heading>
        <ol className="space-y-3">
          <Step n={1} title={steps.write.title}>
            {steps.write.body()}
          </Step>
          <Step n={2} title={steps.assemble.title}>
            {steps.assemble.body()}
          </Step>
          <Step n={3} title={steps.simulate.title}>
            {steps.simulate.body()}
          </Step>
          <Step n={4} title={steps.follow.title}>
            {steps.follow.body()}
          </Step>
        </ol>
      </section>

      <section>
        <Heading>{asm.heading}</Heading>
        <div className="grid gap-4 md:grid-cols-2">
          <pre className="overflow-x-auto rounded-lg border border-line bg-sunken p-3 font-mono text-small leading-[1.6] text-fg">
            {asm.example}
          </pre>
          <ul className="space-y-1.5 text-ui leading-relaxed text-fg-muted">
            <li>{asm.comment()}</li>
            <li>{asm.registers()}</li>
            <li>{asm.label()}</li>
            <li>{asm.sections()}</li>
            <li>
              {asm.numbers()}
              <table className="mt-1.5 font-mono text-small">
                <tbody>
                  {NUMBER_FORMATS.map(([base, one, minusOne]) => (
                    <tr key={base}>
                      <td className="pr-4 font-sans text-fg-muted">{asm.formats[base]}</td>
                      <td className="pr-4 text-right text-fg">{one}</td>
                      <td className="text-right text-fg">{minusOne}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </li>
            <li>{asm.immediate()}</li>
          </ul>
        </div>
      </section>

      <section>
        <Heading>{g.shortcutsHeading}</Heading>
        <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {t.shortcuts.items.map((s) => (
            <div key={s.keys} className="flex items-baseline gap-3">
              <Kbd>{s.keys}</Kbd>
              <span className="text-ui text-fg-muted">{s.note}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-caption text-fg-faint">{t.shortcuts.note}</p>
      </section>

      <section>
        <Heading>{g.settings.heading}</Heading>
        <ul className="space-y-1.5 text-ui leading-relaxed text-fg-muted">
          <li>{g.settings.values()}</li>
          <li>{g.settings.signals()}</li>
          <li>{g.settings.speed()}</li>
          <li>{g.settings.zoom()}</li>
        </ul>
      </section>

      <section>
        <Heading>{g.legendHeading}</Heading>
        <Legend />
      </section>

      <section>
        <Heading>{g.presets.heading}</Heading>
        <div className="grid gap-2 sm:grid-cols-2">
          {PRESET_PROGRAMS.map((p) => (
            <button
              key={p.id}
              disabled={locked}
              onClick={() => {
                setAssemblySource(p.source[locale]);
                onClose();
              }}
              title={locked ? g.presets.lockedTitle : g.presets.loadTitle}
              className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-left text-ui text-fg transition-colors hover:border-line-strong hover:bg-raised disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span>{p.name[locale]}</span>
              <span className="text-small text-fg-faint">{g.presets.load}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
