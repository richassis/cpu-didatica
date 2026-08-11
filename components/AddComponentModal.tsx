"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useLayoutStore } from "@/lib/store";
import { WIDGET_DEFINITIONS, WidgetDefinition, generateDefaultLabel } from "@/lib/widgetDefinitions";
import { ConfigPanelForType, ComponentConfig } from "@/components/widgets/ConfigPanel";
import { GLYPHS } from "@/components/widgets/silhouettes";
import { ArrowLeft, X, Square } from "lucide-react";

type Step = "pick" | "configure";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AddComponentModal({ open: isOpen, onClose: close }: Props) {
  return createPortal(
    <>
      {/* Modal */}
      {isOpen && (
        <AddComponentModalContent onClose={close} />
      )}
    </>,
    document.body
  );
}

function AddComponentModalContent({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>("pick");
  const [selected, setSelected] = useState<WidgetDefinition | null>(null);
  const [config, setConfig] = useState<ComponentConfig>({ label: "" });

  const addComponent = useLayoutStore((s) => s.addComponent);
  const components = useLayoutStore((s) => s.components);

  const handlePick = (def: WidgetDefinition) => {
    setSelected(def);
    setConfig({
      label: generateDefaultLabel(def, components),
      bitWidth: def.type === "Register" || def.type === "PipelineRegister" || def.type === "MuxComponent" || def.type === "MemoryComponent" ? 16 : undefined,
      numInputs: def.type === "MuxComponent" ? 2 : undefined,
      wordCount: def.type === "MemoryComponent" ? 256 : undefined,
    });
    setStep("configure");
  };

  const handleAdd = () => {
    if (!selected) return;
    const finalLabel = config.label.trim() || selected.label;
    const meta: Record<string, unknown> = {};
    if (config.bitWidth !== undefined) meta.bitWidth = config.bitWidth;
    if (config.numInputs !== undefined) meta.numInputs = config.numInputs;
    if (config.wordCount !== undefined) meta.wordCount = config.wordCount;
    addComponent(
      selected.type,
      finalLabel,
      selected.defaultWidth,
      selected.defaultHeight,
      Object.keys(meta).length > 0 ? meta : undefined
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />

      {/* Panel */}
      <div className="relative flex max-h-[80vh] w-[420px] flex-col overflow-hidden rounded-2xl border border-line bg-surface">
        {/* ── Step 1: Pick ── */}
        {step === "pick" && (
          <>
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="t-panel text-fg">Add component</h2>
              <button onClick={onClose} className="text-fg-muted transition-colors hover:text-fg" aria-label="Close"><X size={16} strokeWidth={1.5} /></button>
            </div>
            <ul className="p-2 space-y-1 overflow-y-auto">
              {WIDGET_DEFINITIONS.map((def) => (
                <li key={def.type}>
                  <button
                    onClick={() => handlePick(def)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-fg-muted transition-colors hover:bg-raised hover:text-fg"
                  >
                    {/* Same glyph the node wears on the canvas, so the palette
                        teaches the badge vocabulary rather than a second one. */}
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line">
                      {(() => {
                        const Glyph = GLYPHS[def.type] ?? Square;
                        return <Glyph size={16} strokeWidth={1.5} />;
                      })()}
                    </span>
                    <div className="text-left">
                      <div className="text-sm text-fg">{def.label}</div>
                      <div className="text-[11px] text-fg-faint">
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
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              <button
                onClick={() => setStep("pick")}
                className="mr-1 text-fg-muted transition-colors hover:text-fg"
                aria-label="Back"
              >
                <ArrowLeft size={16} strokeWidth={1.5} />
              </button>
              <h2 className="t-panel flex-1 text-fg">{selected.label}</h2>
              <button onClick={onClose} className="text-fg-muted transition-colors hover:text-fg" aria-label="Close"><X size={16} strokeWidth={1.5} /></button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto">
              <ConfigPanelForType
                type={selected.type}
                config={config}
                onChange={(patch) => setConfig((c) => ({ ...c, ...patch }))}
              />
            </div>

            <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
              <button
                onClick={() => setStep("pick")}
                className="rounded-lg border border-line px-3 py-1.5 text-xs text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
              >
                Back
              </button>
              <button
                onClick={handleAdd}
                className="rounded-lg border border-line-strong bg-raised px-3 py-1.5 text-xs text-fg transition-colors hover:border-st-active"
              >
                Add
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
