"use client";

import { useState, useEffect } from "react";
import { useLayoutStore, ComponentInstance } from "@/lib/store";
import { getWidgetDefinition } from "@/lib/widgetDefinitions";
import { ConfigPanelForType, ComponentConfig } from "@/components/widgets/ConfigPanel";

interface Props {
  component: ComponentInstance;
  onClose: () => void;
}

/**
 * Config modal opened when editing an existing component (e.g. double-click).
 * Persists changes via `updateLabel` (and future per-type updaters).
 */
export default function ConfigModal({ component, onClose }: Props) {
  const updateLabel = useLayoutStore((s) => s.updateLabel);
  const removeComponent = useLayoutStore((s) => s.removeComponent);
  const def = getWidgetDefinition(component.type);

  const [config, setConfig] = useState<ComponentConfig>({
    label: component.label,
  });

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSave = () => {
    updateLabel(component.id, config.label.trim() || (def?.label ?? component.type));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-80 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white">
              {def?.icon} {def?.label ?? component.type}
            </h2>
            <p className="text-[10px] text-gray-500 font-mono mt-0.5">
              id: {component.id.slice(0, 8)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Config fields */}
        <div className="p-4 space-y-4">
          <ConfigPanelForType
            type={component.type}
            config={config}
            onChange={(patch) => setConfig((c) => ({ ...c, ...patch }))}
          />
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-700 flex items-center justify-between gap-2">
          <button
            onClick={() => { removeComponent(component.id); onClose(); }}
            className="text-xs text-red-400 hover:text-red-300 transition-colors"
          >
            Remove
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-3 py-1.5 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
