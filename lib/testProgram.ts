import { Encoder } from "@/lib/simulator/Encoder";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { InstructionMemory } from "@/lib/simulator/InstructionMemory";
import { Memory } from "@/lib/simulator/Memory";

/**
 * Loads a fixed test program directly into instruction memory.
 * TODO: Replace this with assembler integration once available.
 */
export function loadTestProgram(): void {
  const sim = useSimulatorStore.getState();

  const imemEntry = Array.from(sim.objects.entries()).find(([, obj]) => obj instanceof InstructionMemory);
  if (!imemEntry) {
    console.warn("[testProgram] No InstructionMemory found");
    return;
  }

  const imem = imemEntry[1] as InstructionMemory;

  const instructions = [
    Encoder.assemble("LDAI", { gprAddr: 0, operand: 5 }),
    Encoder.assemble("LDAI", { gprAddr: 1, operand: 3 }),
    Encoder.assemble("ADD", { srcA: 0, srcB: 1, dst: 2 }),
    Encoder.assemble("STA", { gprAddr: 2, operand: 0 }),
    Encoder.assemble("HLT"),
  ];

  imem.load(instructions);

  const memEntry = Array.from(sim.objects.entries()).find(([, obj]) => obj instanceof Memory);
  if (memEntry) {
    (memEntry[1] as Memory).reset();
  }

  sim.touch();

  console.log(
    "[testProgram] Program loaded:",
    instructions.map((instruction) => `0x${instruction.toString(16).padStart(4, "0")}`),
  );
}
