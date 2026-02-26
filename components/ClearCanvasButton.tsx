"use client";

import { useState } from "react";
import { useLayoutStore } from "@/lib/store";

export default function ClearCanvasButton() {
  const components = useLayoutStore((s) => s.components);
  const clearComponents = useLayoutStore((s) => s.clearComponents);
  const [confirming, setConfirming] = useState(false);

  if (components.length === 0) return null;

  if (confirming) {
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 mb-16 z-40 flex items-center gap-2 bg-gray-900/95 border border-red-700 rounded-full px-4 py-2 shadow-xl backdrop-blur-sm">
        <span className="text-xs text-red-300 font-semibold whitespace-nowrap">
          Delete all {components.length} component{components.length !== 1 ? "s" : ""}?
        </span>
        <button
          onClick={() => { clearComponents(); setConfirming(false); }}
          className="text-xs font-bold bg-red-600 hover:bg-red-500 text-white rounded-full px-3 py-1 transition-colors"
        >
          Yes
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs text-gray-400 hover:text-white transition-colors px-1"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="fixed bottom-24 right-6 z-40 w-12 h-12 rounded-full bg-gray-800 hover:bg-red-700 border border-gray-600 hover:border-red-500 text-gray-400 hover:text-white shadow-lg flex items-center justify-center transition-all"
      aria-label="Clear canvas"
      title="Clear all components"
    >
      🗑
    </button>
  );
}
