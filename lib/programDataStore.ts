/**
 * programDataStore.ts
 *
 * Program Mode state: the student's assembly source, the file it came from,
 * and running it.
 *
 * This used to also carry a `.cpudat` format for GPR/memory values. That was a
 * third serialization of state that already had two homes — the `state`
 * snapshot inside a `.cpud` project, and the `.data` directive the assembler
 * turns into `dataWords` — so it was removed rather than maintained.
 *
 * The source is persisted: a student who reloads the page should not lose the
 * program they were writing. Nothing about a *run* is persisted, so a page
 * reloaded mid-execution comes back idle rather than stuck on "Executando…".
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { useExecutionStore } from "@/lib/executionStore";
import { InstructionMemory } from "@/lib/simulator";
import { assemble, type AssembleResult, type AssemblyError } from "@/lib/assembler";
import { PRESET_PROGRAMS } from "@/lib/presetPrograms";
import { triggerDownload } from "@/lib/download";
import {
  CODE_FILE_MIME,
  DEFAULT_PROGRAM_BASENAME,
  looksBinary,
  programNameFromFile,
} from "@/lib/codeFile";

interface ProgramDataState {
  // ── Assembly source ─────────────────────────────────────────

  /** Current assembly source text in the editor */
  assemblySource: string;

  /**
   * Base name of the program, without extension. Seeded from the imported
   * file so a save round-trips the name the student opened.
   */
  programName: string;

  /** Update the assembly source */
  setAssemblySource: (src: string) => void;

  setProgramName: (name: string) => void;

  /**
   * Read any text file and set `assemblySource` from its contents.
   *
   * There is no extension check — a program is text, and the student may keep
   * it in a `.txt`, a `.asm` or anything else. Binaries are rejected on
   * content instead, so picking a `.png` by mistake fails with a message
   * rather than filling the editor with mojibake.
   */
  importAssembly: (file: File) => Promise<void>;

  /** Download the current source under `fileName`. */
  exportAssembly: (fileName: string) => void;

  /** True while a program run is executing and snapshots are being captured. */
  isRunning: boolean;

  /** Errors from the most recent assembly attempt (empty = success or not yet run). */
  assemblyErrors: AssemblyError[];

  /**
   * Result of the most recent explicit Montar. `null` until the student
   * presses Montar (or opens a file), or again after an empty source.
   * Never recomputed as a side effect of typing — see `mountedSource`.
   */
  assembled: AssembleResult | null;

  /**
   * The exact source text `assembled` was produced from. Compared against
   * the live `assemblySource` to tell a fresh listing from a stale one
   * (`mountStatus` below) — typing does not re-assemble on its own anymore.
   */
  mountedSource: string | null;

  /** Assemble the current source and record the result (the "Montar" action). */
  mountProgram: () => void;

  /** Load the last mounted program and execute it. Requires a clean mount. */
  runProgram: () => void;
}

function computeAssembled(source: string): AssembleResult | null {
  return assemble(source);
}

export const useProgramDataStore = create<ProgramDataState>()(
  persist(
    (set, get) => ({
      assemblySource: PRESET_PROGRAMS[0].source,
      programName: DEFAULT_PROGRAM_BASENAME,
      isRunning: false,
      assemblyErrors: [],
      assembled: null,
      mountedSource: null,

      setAssemblySource: (src) => set({ assemblySource: src }),

      setProgramName: (name) => set({ programName: name }),

      importAssembly: (file) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const text = e.target?.result;
            if (typeof text !== "string") {
              reject(new Error("Não foi possível ler o arquivo como texto."));
              return;
            }
            if (looksBinary(text)) {
              reject(
                new Error(
                  `"${file.name}" não parece ser um arquivo de texto. ` +
                    "Escolha um arquivo com o código-fonte."
                )
              );
              return;
            }
            // Opened desmontado — pressing Montar is the same next step as
            // after typing, whether the source came from the keyboard or a file.
            set({
              assemblySource: text,
              programName: programNameFromFile(file.name),
              assembled: null,
              assemblyErrors: [],
              mountedSource: null,
            });
            resolve();
          };
          reader.onerror = () => reject(reader.error);
          reader.readAsText(file);
        }),

      exportAssembly: (fileName) => {
        const { assemblySource } = get();
        triggerDownload(new Blob([assemblySource], { type: CODE_FILE_MIME }), fileName);
      },

      mountProgram: () => {
        const src = get().assemblySource;
        const result = computeAssembled(src);
        set({ assembled: result, assemblyErrors: result?.errors ?? [], mountedSource: src });

        // Montar is a fresh start: clear any residue left on the datapath by a
        // previous run so the canvas doesn't show stale values before Executar.
        const execution = useExecutionStore.getState();
        if (execution.isTimelineActive) {
          execution.exitTimeline();
        } else {
          useSimulatorStore.getState().resetClock();
        }
      },

      runProgram: () => {
        const { isRunning, assembled } = get();
        // Executar requires a clean, up-to-date mount — mountStatus(get()) !== "ok"
        // guards this from the UI already, but the action re-checks so it can
        // never run a stale or errored build if called directly.
        if (isRunning || mountStatus(get()) !== "ok" || !assembled) return;

        set({ isRunning: true });

        const execution = useExecutionStore.getState();
        if (execution.isTimelineActive) {
          execution.exitTimeline();
        }

        window.setTimeout(() => {
          try {
            // Assembly succeeded: load words into IMEM, reset data memory.
            const sim = useSimulatorStore.getState();

            const imemEntry = Array.from(sim.objects.entries())
              .find(([, obj]) => obj instanceof InstructionMemory);
            if (imemEntry) {
              const imem = imemEntry[1] as InstructionMemory;
              // Clear first so a shorter program can't leave a previous one's
              // instructions sitting past its end.
              imem.clear();
              imem.load(assembled.words);
            }

            sim.touch();

            execution.loadAndExecute(assembled.dataWords);
          } finally {
            set({ isRunning: false });
          }
        }, 0);
      },
    }),
    {
      name: "simulator-program",
      version: 1,
      // Only the document, never the run. `isRunning` in particular must not
      // come back from storage, or a reload during a run leaves the Run button
      // permanently disabled. `assembled`/`mountedSource` are not persisted
      // either — a reload comes back with the source but not yet mounted,
      // same as opening a file.
      partialize: (state) => ({
        assemblySource: state.assemblySource,
        programName: state.programName,
      }),
    }
  )
);

/**
 * Whether the current source has a usable, up-to-date mount. Derived rather
 * than stored so the Montar/Executar bar and the Montagem panel read the
 * exact same rule instead of duplicating it.
 *
 *  - "none":   nothing mounted yet (fresh session, or after opening a file).
 *  - "stale":  the source has changed since the last Montar.
 *  - "errors": the last Montar failed (or produced nothing, i.e. empty source).
 *  - "ok":     mounted, matches the current source, no errors — Executar may run.
 */
export function mountStatus(
  s: Pick<ProgramDataState, "mountedSource" | "assemblySource" | "assembled" | "assemblyErrors">
): "none" | "stale" | "errors" | "ok" {
  if (s.mountedSource === null) return "none";
  if (s.mountedSource !== s.assemblySource) return "stale";
  if (s.assembled === null || s.assemblyErrors.length > 0) return "errors";
  return "ok";
}
