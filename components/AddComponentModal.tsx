"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useLayoutStore } from "@/lib/store";
import { WIDGET_DEFINITIONS, WidgetDefinition, generateDefaultLabel } from "@/lib/widgetDefinitions";
import { ConfigPanelForType, ComponentConfig } from "@/components/widgets/ConfigPanel";

type Step = "pick" | "configure";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AddComponentModal({ open: isOpen, onClose: close }: Props) {
  const [step, setStep] = useState<Step>("pick");
  const [selected, setSelected] = useState<WidgetDefinition | null>(null);
  const [config, setConfig] = useState<ComponentConfig>({ label: "" });

  const addComponent = useLayoutStore((s) => s.addComponent);
  const components = useLayoutStore((s) => s.components);

  // Reset state whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setStep("pick");
      setSelected(null);
      setConfig({ label: "" });
    }
  }, [isOpen]);

  const handlePick = (def: WidgetDefinition) => {
    setSelected(def);
    setConfig({
      label:     generateDefaultLabel(def, components),
      bitWidth:  def.type === "Register" || def.type === "MuxComponent" || def.type === "MemoryComponent" ? 16 : undefined,
      numInputs: def.type === "MuxComponent" ? 2 : undefined,
      wordCount: def.type === "MemoryComponent" ? 256 : undefined,
    });
    setStep("configure");
  };

  const handleAdd = () => {
    if (!selected) return;
    const finalLabel = config.label.trim() || selected.label;
    const meta: Record<string, unknown> = {};
    if (config.bitWidth  !== undefined) meta.bitWidth  = config.bitWidth;
    if (config.numInputs !== undefined) meta.numInputs = config.numInputs;
    if (config.wordCount !== undefined) meta.wordCount = config.wordCount;
    addComponent(selected.type, finalLabel, selected.defaultWidth, selected.defaultHeight,
      Object.keys(meta).length > 0 ? meta : undefined);
    close();
  };

  return createPortal(
    <>
      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50" onClick={close} />

          {/* Panel */}
          <div className="relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-80 max-h-[80vh] flex flex-col overflow-hidden">

            {/* ── Step 1: Pick ── */}
            {step === "pick" && (
              <>
                <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-white">Add Component</h2>
                  <button onClick={close} className="text-gray-400 hover:text-white text-lg leading-none">✕</button>
                </div>
                <ul className="p-2 space-y-1 overflow-y-auto">
                  {WIDGET_DEFINITIONS.map((def) => (
                    <li key={def.type}>
                      <button
                        onClick={() => handlePick(def)}
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-gray-800 text-gray-200 transition-colors"
                      >
                        <span className="text-2xl">{def.icon}</span>
                        <div className="text-left">
                          <div className="text-sm font-semibold">{def.label}</div>
                          <div className="text-xs text-gray-500">
                            {def.description} · {def.defaultWidth}×{def.defaultHeight}px
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {/* ── Step 2: Configure ── */}
            {step === "configure" && selected && (
              <>
                <div className="px-4 py-3 border-b border-gray-700 flex items-center gap-2">
                  <button
                    onClick={() => setStep("pick")}
                    className="text-gray-400 hover:text-white text-lg leading-none mr-1"
                    aria-label="Back"
                  >
                    ←
                  </button>
                  <span className="text-lg">{selected.icon}</span>
                  <h2 className="text-sm font-bold text-white flex-1">{selected.label}</h2>
                  <button onClick={close} className="text-gray-400 hover:text-white text-lg leading-none">✕</button>
                </div>

                <div className="p-4 space-y-4 overflow-y-auto">
                  <ConfigPanelForType
                    type={selected.type}
                    config={config}
                    onChange={(patch) => setConfig((c) => ({ ...c, ...patch }))}
                  />
                </div>

                <div className="px-4 py-3 border-t border-gray-700 flex justify-end gap-2">
                  <button
                    onClick={() => setStep("pick")}
                    className="px-3 py-1.5 text-xs rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleAdd}
                    className="px-3 py-1.5 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors"
                  >
                    Add
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>,
    document.body
  );
}
