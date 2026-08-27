"use client";

import { Hammer, Play, LoaderCircle } from "lucide-react";
import { useProgramDataStore, mountStatus } from "@/lib/programDataStore";
import { useExecutionStore } from "@/lib/executionStore";

/**
 * The Montar / Executar pair, in one strip above both code panels.
 *
 * Montagem used to be an invisible side effect of typing (debounced, 300ms
 * behind the cursor) and Executar lived in the top bar, silently re-
 * assembling underneath itself. That hid the fact that mounting and running
 * are two separate steps — which is the point being taught. Now Montar is
 * the only thing that produces a listing, and Executar refuses to run
 * anything that is not a clean, up-to-date mount (`mountStatus`).
 *
 * Staying visible above the panels — not inside either header — means the
 * pair still works when Assembly, Montagem, or both are collapsed to a rail.
 *
 * Which button carries the accent follows the state: unmounted or stale,
 * Montar is the thing to press next and gets the emphasis while Executar
 * sits disabled; once the mount is clean, the emphasis moves to Executar.
 * Never both accented at once — there is exactly one next step at a time.
 */
export default function BuildBar() {
  const assemblySource = useProgramDataStore((s) => s.assemblySource);
  const mountedSource = useProgramDataStore((s) => s.mountedSource);
  const assembled = useProgramDataStore((s) => s.assembled);
  const assemblyErrors = useProgramDataStore((s) => s.assemblyErrors);
  const isRunning = useProgramDataStore((s) => s.isRunning);
  const mountProgram = useProgramDataStore((s) => s.mountProgram);
  const runProgram = useProgramDataStore((s) => s.runProgram);
  const isTimelineActive = useExecutionStore((s) => s.isTimelineActive);

  const isLocked = isTimelineActive || isRunning;
  const status = mountStatus({ mountedSource, assemblySource, assembled, assemblyErrors });
  const canRun = status === "ok" && !isLocked;

  const runTitle = isLocked
    ? "Execução em andamento"
    : status === "none"
      ? "Monte o programa primeiro"
      : status === "stale"
        ? "Montagem desatualizada — monte de novo"
        : status === "errors"
          ? "Corrija os erros de montagem"
          : "Montar o programa e executar até HLT";

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-2">
      <button
        onClick={() => mountProgram()}
        disabled={isLocked}
        title="Montar (compilar) o código-fonte"
        className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          status === "ok"
            ? "border-line text-fg-muted hover:border-line-strong hover:text-fg"
            : "border-st-active bg-st-active/10 text-fg"
        }`}
      >
        <Hammer size={14} strokeWidth={1.5} className={status === "ok" ? "" : "text-st-active"} />
        Montar
        {status === "stale" && (
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-st-warn" aria-hidden />
        )}
      </button>

      <button
        onClick={() => runProgram()}
        disabled={!canRun}
        title={runTitle}
        className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          status === "ok"
            ? "border-st-active bg-st-active/10 text-fg"
            : "border-line text-fg-muted hover:border-line-strong hover:text-fg"
        }`}
      >
        {isRunning ? (
          <LoaderCircle size={14} strokeWidth={1.5} className="animate-spin text-st-active" />
        ) : (
          <Play size={14} strokeWidth={1.5} className={status === "ok" ? "text-st-active" : ""} />
        )}
        {isRunning ? "Executando…" : "Executar"}
      </button>

      <span
        className={`ml-auto min-w-0 shrink truncate font-mono text-[11px] ${
          status === "errors" ? "text-st-error" : "text-fg-faint"
        }`}
      >
        {status === "errors" &&
          `${assemblyErrors.length} ${assemblyErrors.length === 1 ? "erro" : "erros"}`}
        {status === "ok" && assembled && `${assembled.listing.length} instruções`}
        {status === "stale" && "desatualizado"}
        {status === "none" && "não montado"}
      </span>
    </div>
  );
}
