"use client";

import { createContext, useContext } from "react";

/**
 * May the controls inside this canvas mutate the datapath?
 *
 * The canvas is mounted twice — once for authoring, once read-only inside the
 * program-mode viewer — so "am I in edit mode?" is not the whole question: the
 * viewer renders in edit mode too if a developer has both open. Only
 * `SimulatorCanvas` knows both halves of the answer, so it provides it here
 * rather than every node, port and wire re-deriving it from the mode store.
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
