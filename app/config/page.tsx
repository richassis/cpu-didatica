"use client";

export default function ConfigPage() {
  return (
    <div className="flex-1 overflow-auto p-8 bg-gray-950 text-gray-100">
      <h1 className="text-2xl font-bold mb-6">Configuration</h1>

      <div className="max-w-md space-y-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-2">Canvas</h2>
          <p className="text-sm text-gray-400">
            The simulator canvas is infinite (10 000 × 10 000 virtual pixels).
            Use Ctrl + Scroll to zoom and scroll to pan.
          </p>
        </div>
      </div>
    </div>
  );
}
