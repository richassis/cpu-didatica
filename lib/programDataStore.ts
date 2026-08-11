/**
 * programDataStore.ts
 *
 * Zustand slice (not persisted) for Program Mode I/O state:
 * - Assembly source text (editable in AssemblyPanel)
 * - Assembly file import/export (.asm / .s)
 * - Data file import/export (.cpudat) — GPR registers + Memory + InstructionMemory cells
 */

import { create } from "zustand";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { useExecutionStore } from "@/lib/executionStore";
import { Gpr, Memory, InstructionMemory } from "@/lib/simulator";
import { assemble, type AssemblyError } from "@/lib/assembler";
import { loadTestProgram } from "@/lib/testProgram";
import { PRESET_PROGRAMS } from "@/lib/presetPrograms";

/** Schema for .cpudat files */
export interface CpuDataFile {
  version: 1;
  /** Map from GPR component id → register values array */
  gpr: Record<string, number[]>;
  /** Map from Memory component id → cells array */
  memory: Record<string, number[]>;
  /** Map from InstructionMemory component id → cells array */
  instructionMemory: Record<string, number[]>;
}

interface ProgramDataState {
  // ── Assembly source ─────────────────────────────────────────

  /** Current assembly source text in the editor */
  assemblySource: string;

  /** Update the assembly source */
  setAssemblySource: (src: string) => void;

  /** Read a .asm/.s file and set assemblySource from its text content */
  importAssembly: (file: File) => Promise<void>;

  /** Download current assemblySource as program.asm */
  exportAssembly: () => void;

  /** True while a program run is executing and snapshots are being captured. */
  isRunning: boolean;

  /** Errors from the most recent assembly attempt (empty = success or not yet run). */
  assemblyErrors: AssemblyError[];

  /** Assemble, load, and execute the current program source. */
  runProgram: () => void;

  // ── Data I/O ────────────────────────────────────────────────

  /**
   * Parse a .cpudat JSON file and write its values into the live simulator:
   * - GPR registers via pokeGprRegister
   * - Memory cells via pokeMemory
   * - InstructionMemory cells via pokeInstructionMemory
   */
  importData: (file: File) => Promise<void>;

  /**
   * Read GPR + Memory + InstructionMemory from the live simulator and
   * download as data.cpudat (JSON).
   */
  exportData: () => void;
}

export const useProgramDataStore = create<ProgramDataState>()((set, get) => ({
  assemblySource: PRESET_PROGRAMS[0].source,
  isRunning: false,
  assemblyErrors: [],

  setAssemblySource: (src) => set({ assemblySource: src }),

  importAssembly: (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result;
        if (typeof text === "string") {
          set({ assemblySource: text });
          resolve();
        } else {
          reject(new Error("Failed to read file as text"));
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    }),

  exportAssembly: () => {
    const { assemblySource } = useProgramDataStore.getState();
    const blob = new Blob([assemblySource], { type: "text/plain" });
    triggerDownload(blob, "program.asm");
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

  importData: (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result;
          if (typeof text !== "string") throw new Error("Failed to read file");

          const data = JSON.parse(text) as CpuDataFile;
          if (data.version !== 1) throw new Error("Unsupported .cpudat version");

          const sim = useSimulatorStore.getState();

          // Restore GPR registers
          for (const [id, values] of Object.entries(data.gpr ?? {})) {
            values.forEach((v, i) => sim.pokeGprRegister(id, i, v));
          }

          // Restore Memory cells
          for (const [id, cells] of Object.entries(data.memory ?? {})) {
            cells.forEach((v, addr) => sim.pokeMemory(id, addr, v));
          }

          // Restore InstructionMemory cells
          for (const [id, cells] of Object.entries(data.instructionMemory ?? {})) {
            cells.forEach((v, addr) => sim.pokeInstructionMemory(id, addr, v));
          }

          sim.touch();
          resolve();
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    }),

  exportData: () => {
    const sim = useSimulatorStore.getState();
    const objects = sim.objects;

    const gpr: Record<string, number[]> = {};
    const memory: Record<string, number[]> = {};
    const instructionMemory: Record<string, number[]> = {};

    for (const [id, obj] of objects) {
      if (obj instanceof Gpr) {
        gpr[id] = obj.snapshot().map((r) => r.value);
      } else if (obj instanceof InstructionMemory) {
        instructionMemory[id] = obj.dump();
      } else if (obj instanceof Memory) {
        memory[id] = obj.dump();
      }
    }

    const data: CpuDataFile = { version: 1, gpr, memory, instructionMemory };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    triggerDownload(blob, "data.cpudat");
  },
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
