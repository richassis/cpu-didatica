/**
 * Modular per-widget configuration panels.
 *
 * Each panel receives the current config state and an onChange callback.
 * The shell (ConfigModal) owns the state; panels just render fields.
 *
 * To add type-specific fields: extend the relevant panel component below
 * and add its fields to ComponentConfig.
 */

export interface ComponentConfig {
  label: string;
  /** Bit width for Register (and Mux inputs). Default 16. */
  bitWidth?: number;
  /** Number of data inputs for Mux (2 or 3). Default 2. */
  numInputs?: number;
  /** Number of addressable words for Memory. Default 256. */
  wordCount?: number;
}

interface PanelProps {
  config: ComponentConfig;
  onChange: (patch: Partial<ComponentConfig>) => void;
}

// ── Shared field: Name ─────────────────────────────────────────────────────

function NameField({ config, onChange }: PanelProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
        Name
      </label>
      <input
        type="text"
        value={config.label}
        onChange={(e) => onChange({ label: e.target.value })}
        className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
        placeholder="Component name…"
        autoFocus
      />
    </div>
  );
}

// ── Shared field: Bit Width ────────────────────────────────────────────────

function BitWidthField({ config, onChange }: PanelProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
        Bit Width
      </label>
      <select
        value={config.bitWidth ?? 16}
        onChange={(e) => onChange({ bitWidth: Number(e.target.value) })}
        className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
      >
        {[4, 8, 16, 32].map((b) => (
          <option key={b} value={b}>{b}-bit</option>
        ))}
      </select>
    </div>
  );
}

// ── Per-type panels ────────────────────────────────────────────────────────

export function LabelWidgetConfigPanel(props: PanelProps) {
  return <NameField {...props} />;
}

export function ValueDisplayWidgetConfigPanel(props: PanelProps) {
  return <NameField {...props} />;
}

export function GprComponentConfigPanel(props: PanelProps) {
  return <NameField {...props} />;
}

export function MemoryComponentConfigPanel(props: PanelProps) {
  return (
    <div className="flex flex-col gap-3">
      <NameField {...props} />
      <BitWidthField {...props} />
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
          Word Count
        </label>
        <select
          value={props.config.wordCount ?? 256}
          onChange={(e) => props.onChange({ wordCount: Number(e.target.value) })}
          className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
        >
          {[64, 128, 256, 512, 1024, 2048, 4096].map((n) => (
            <option key={n} value={n}>{n} words</option>
          ))}
        </select>
      </div>
    </div>
  );
}

// InstructionMemory and MainMemory use the same config as Memory
export const InstructionMemoryComponentConfigPanel = MemoryComponentConfigPanel;
export const MainMemoryComponentConfigPanel = MemoryComponentConfigPanel;

export function UlaComponentConfigPanel(props: PanelProps) {
  return <NameField {...props} />;
}

export function RegisterComponentConfigPanel(props: PanelProps) {
  return (
    <div className="flex flex-col gap-3">
      <NameField {...props} />
      <BitWidthField {...props} />
    </div>
  );
}

export function MuxComponentConfigPanel(props: PanelProps) {
  return (
    <div className="flex flex-col gap-3">
      <NameField {...props} />
      <BitWidthField {...props} />
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
          Number of Inputs
        </label>
        <select
          value={props.config.numInputs ?? 2}
          onChange={(e) => props.onChange({ numInputs: Number(e.target.value) })}
          className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
        >
          <option value={2}>2 inputs</option>
          <option value={3}>3 inputs</option>
        </select>
      </div>
    </div>
  );
}

// ── Dispatcher ────────────────────────────────────────────────────────────

export function ConfigPanelForType({
  type,
  ...props
}: PanelProps & { type: string }) {
  switch (type) {
    case "LabelWidget":
      return <LabelWidgetConfigPanel {...props} />;
    case "ValueDisplayWidget":
      return <ValueDisplayWidgetConfigPanel {...props} />;
    case "GprComponent":
      return <GprComponentConfigPanel {...props} />;
    case "MemoryComponent":
      return <MemoryComponentConfigPanel {...props} />;
    case "InstructionMemoryComponent":
      return <InstructionMemoryComponentConfigPanel {...props} />;
    case "MainMemoryComponent":
      return <MainMemoryComponentConfigPanel {...props} />;
    case "UlaComponent":
      return <UlaComponentConfigPanel {...props} />;
    case "Register":
      return <RegisterComponentConfigPanel {...props} />;
    case "MuxComponent":
      return <MuxComponentConfigPanel {...props} />;
    default:
      return <NameField {...props} />;
  }
}
