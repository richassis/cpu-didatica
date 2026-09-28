/**
 * useExecutingAddr.ts
 *
 * The instruction address an instruction-memory view should highlight on the
 * timeline, or undefined outside it.
 *
 * The highlight follows the instruction being *executed*, not the address on
 * the memory's own address port (the PC runs ahead to PC+1). That address
 * changes at FETCH, but the memory only learns of it when the PC's wire lands
 * on its address port. Until then the row keeps pointing at the instruction
 * that was executing before — the value in the frame's pre-tick snapshot —
 * and it moves in step with the animation instead of at the start of the tick.
 *
 * `isRevealed` is true whenever no animation is running, so a settled frame
 * (and a skipped or instant animation) always shows the post-tick address.
 */

import { useExecutionStore } from "./executionStore";
import { useDisplayMaskStore } from "./displayMaskStore";

export function useExecutingAddr(instructionMemoryId: string): number | undefined {
  const frame = useExecutionStore((s) =>
    s.isTimelineActive ? s.frames[s.currentIndex] : undefined
  );
  const revealed = useDisplayMaskStore((s) => s.isRevealed(instructionMemoryId));

  if (!frame) return undefined;
  return revealed ? frame.postTick.pc : frame.preTick.pc;
}
