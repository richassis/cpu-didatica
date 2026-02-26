"use client";

import { useState } from "react";
import { useLayoutStore } from "@/lib/store";

export default function ConfigPage() {
  const { canvasSize, setCanvasSize } = useLayoutStore();
  const [width, setWidth] = useState(String(canvasSize.width));
  const [height, setHeight] = useState(String(canvasSize.height));
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    const w = Math.max(500, Math.min(10000, Number(width) || 3000));
    const h = Math.max(500, Math.min(10000, Number(height) || 2000));
    setCanvasSize(w, h);
    setWidth(String(w));
    setHeight(String(h));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex-1 overflow-auto p-8 bg-gray-950 text-gray-100">
      <h1 className="text-2xl font-bold mb-6">Configuration</h1>

      <div className="max-w-md space-y-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold">Canvas Size</h2>
          <p className="text-sm text-gray-400">
            Set the width and height of the simulator canvas in pixels (500 –
            10,000).
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Width (px)
              </label>
              <input
                type="number"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Height (px)
              </label>
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <button
            onClick={handleSave}
            className="bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
          >
            {saved ? "✓ Saved" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
