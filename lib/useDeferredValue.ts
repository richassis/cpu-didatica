/**
 * useDeferredValue.ts
 *
 * Custom hook for widget components to read display values that are
 * synchronized with wire animations.  During an animation, returns
 * the snapshotted (pre-tick) value until the component is revealed.
 */

import { useSnapshotStore } from "@/lib/snapshotStore";

/**
 * Returns the display value for a component output port, respecting
 * deferred display during animations.
 *
 * @param componentId  The simulator object ID
 * @param portName     The output port name (as used in getPorts())
 * @param liveValue    The current committed (live) value from the simulator
 * @returns The value to display: snapshot value during animation, live value after reveal
 */
export function useDeferredPortValue(
  componentId: string,
  portName: string,
  liveValue: number,
): number {
  const isAnimating = useSnapshotStore((s) => s.isAnimating);
  const revealRevision = useSnapshotStore((s) => s.revealRevision);
  // Subscribe to revealRevision so the component re-renders when revealed
  void revealRevision;

  if (!isAnimating) return liveValue;

  const state = useSnapshotStore.getState();
  if (!state.shouldDefer(componentId)) return liveValue;

  const snapVal = state.getSnapshotPortValue(componentId, portName);
  return snapVal !== undefined ? snapVal : liveValue;
}

/**
 * Returns whether a component should currently show deferred (snapshot) values.
 * Useful for components that need to defer multiple values at once (GPR, Memory).
 */
export function useShouldDefer(componentId: string): boolean {
  const isAnimating = useSnapshotStore((s) => s.isAnimating);
  const revealRevision = useSnapshotStore((s) => s.revealRevision);
  void revealRevision;

  if (!isAnimating) return false;
  return useSnapshotStore.getState().shouldDefer(componentId);
}

/**
 * Returns the snapshot register bank for a GPR component, or undefined
 * if no snapshot is active or the component is revealed.
 */
export function useDeferredRegisters(componentId: string): number[] | undefined {
  const deferred = useShouldDefer(componentId);
  if (!deferred) return undefined;
  return useSnapshotStore.getState().getSnapshotRegisters(componentId);
}
