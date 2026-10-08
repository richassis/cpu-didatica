"use client";

import { createContext, useContext } from "react";

/**
 * May the controls inside this canvas mutate the datapath?
 *
 * The same `SimulatorCanvas` serves both modes — as the authoring canvas in
 * edit mode and read-only inside the program-mode viewer — so the answer
 * depends on which canvas a control sits in, not only on the mode. Only
 * `SimulatorCanvas` knows both halves (the mode and its `isReadOnly` prop), so
 * it provides the answer here rather than every node, port and wire
 * re-deriving it from the mode store.
 *
 * The default is `false`. Anything rendered outside a provider is read-only,
 * which is the safe direction to fail.
 */
const CanvasEditingContext = createContext(false);

export const CanvasEditingProvider = CanvasEditingContext.Provider;

/** True when this canvas accepts edits. */
export function useCanvasEditing(): boolean {
  return useContext(CanvasEditingContext);
}
