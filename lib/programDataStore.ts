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
import { assemble, type AssemblyError } from "@/lib/assembler";
import { loadTestProgram } from "@/lib/testProgram";
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

  /** Assemble, load, and execute the current program source. */
  runProgram: () => void;
}

export const useProgramDataStore = create<ProgramDataState>()(
  persist(
    (set, get) => ({
      assemblySource: PRESET_PROGRAMS[0].source,
      programName: DEFAULT_PROGRAM_BASENAME,
      isRunning: false,
      assemblyErrors: [],

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
            set({ assemblySource: text, programName: programNameFromFile(file.name) });
            resolve();
          };
          reader.onerror = () => reject(reader.error);
          reader.readAsText(file);
        }),

      exportAssembly: (fileName) => {
        const { assemblySource } = get();
        triggerDownload(new Blob([assemblySource], { type: CODE_FILE_MIME }), fileName);
      },

      runProgram: () => {
        const { isRunning, assemblySource } = get();
        if (isRunning) return;

        set({ isRunning: true, assemblyErrors: [] });

        const execution = useExecutionStore.getState();
        if (execution.isTimelineActive) {
          execution.exitTimeline();
        }

        window.setTimeout(() => {
          try {
            const result = assemble(assemblySource);

            if (result === null) {
              // Empty source — fall back to the built-in test program.
              loadTestProgram();
            } else if (result.errors.length > 0) {
              // Assembly failed: show errors, do not execute.
              set({ assemblyErrors: result.errors, isRunning: false });
              return;
            } else {
              // Assembly succeeded: load words into IMEM, reset data memory.
              const sim = useSimulatorStore.getState();

              const imemEntry = Array.from(sim.objects.entries())
                .find(([, obj]) => obj instanceof InstructionMemory);
              if (imemEntry) {
                (imemEntry[1] as InstructionMemory).load(result.words);
              }

              sim.touch();
            }

            execution.loadAndExecute(result?.dataWords ?? []);
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
      // permanently disabled.
      partialize: (state) => ({
        assemblySource: state.assemblySource,
        programName: state.programName,
      }),
    }
  )
);
