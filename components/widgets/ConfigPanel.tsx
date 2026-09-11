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
  /** Whether Register has a write-enable input port. Default true. */
  hasWriteEnable?: boolean;
  /** Fixed numeric value for ConstantComponent. Default 1. */
  constantValue?: number;
  /** How much an IncrementerComponent adds to its input. Default 1. */
  step?: number;
  /**
   * Swap this instance's left/right port sides. Port layout otherwise comes
   * from the widget definition, which is shared by every component of a type —
   * this is the escape hatch for the one that sits against the flow (MAR is fed
   * from its right, so unmirrored its input wire wraps around the block).
   */
  mirrorPorts?: boolean;
}

interface PanelProps {
  config: ComponentConfig;
  onChange: (patch: Partial<ComponentConfig>) => void;
}

// ── Shared field: Name ─────────────────────────────────────────────────────

function NameField({ config, onChange }: PanelProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="t-section">
        Name
      </label>
      <input
        type="text"
        value={config.label}
        onChange={(e) => onChange({ label: e.target.value })}
        className="h-9 rounded-lg border border-line bg-sunken px-3 text-sm text-fg transition-colors focus:border-line-strong focus:outline-none"
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
      <label className="t-section">
        Bit Width
      </label>
      <select
        value={config.bitWidth ?? 16}
        onChange={(e) => onChange({ bitWidth: Number(e.target.value) })}
        className="h-9 rounded-lg border border-line bg-sunken px-3 text-sm text-fg transition-colors focus:border-line-strong focus:outline-none"
      >
        {[4, 8, 16, 32].map((b) => (
          <option key={b} value={b}>{b}-bit</option>
        ))}
      </select>
    </div>
  );
}

// ── Shared field: Toggle ───────────────────────────────────────────────────

function ToggleField({
  title,
  hint,
  checked,
  onToggle,
}: {
  title: string;
  hint: string;
  checked: boolean;
  onToggle: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-line px-3 py-2">
      <div className="flex flex-col">
        <span className="text-xs text-fg">{title}</span>
        <span className="text-[11px] text-fg-faint">{hint}</span>
      </div>
      <label className="relative inline-flex cursor-pointer items-center">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={(e) => onToggle(e.target.checked)}
        />
        <div className="h-5 w-9 rounded-full border border-line-strong transition-colors peer-checked:border-st-active" />
        <div className="absolute left-[3px] top-[3px] h-3 w-3 rounded-full bg-line-strong transition-transform peer-checked:translate-x-4 peer-checked:bg-st-active" />
      </label>
    </div>
  );
}

// ── Per-type panels ────────────────────────────────────────────────────────

export function GprComponentConfigPanel(props: PanelProps) {
  return <NameField {...props} />;
}

export function MemoryComponentConfigPanel(props: PanelProps) {
  return (
    <div className="flex flex-col gap-3">
      <NameField {...props} />
      <BitWidthField {...props} />
      <div className="flex flex-col gap-1">
        <label className="t-section">
          Word Count
        </label>
        <select
          value={props.config.wordCount ?? 256}
          onChange={(e) => props.onChange({ wordCount: Number(e.target.value) })}
          className="h-9 rounded-lg border border-line bg-sunken px-3 text-sm text-fg transition-colors focus:border-line-strong focus:outline-none"
        >
          {[64, 128, 256, 512, 1024, 2048, 4096].map((n) => (
            <option key={n} value={n}>{n} words</option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function InstructionMemoryComponentConfigPanel(props: PanelProps) {
  return (
    <div className="flex flex-col gap-3">
      <NameField {...props} />
      <BitWidthField {...props} />
      <div className="flex flex-col gap-1">
        <label className="t-section">
          Word Count
        </label>
        <select
          value={props.config.wordCount ?? 256}
          onChange={(e) => props.onChange({ wordCount: Number(e.target.value) })}
          className="h-9 rounded-lg border border-line bg-sunken px-3 text-sm text-fg transition-colors focus:border-line-strong focus:outline-none"
        >
          {[64, 128, 256, 512, 1024, 2048, 4096].map((n) => (
            <option key={n} value={n}>{n} words</option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function UlaComponentConfigPanel(props: PanelProps) {
  return <NameField {...props} />;
}

export function RegisterComponentConfigPanel(props: PanelProps) {
  return (
    <div className="flex flex-col gap-3">
      <NameField {...props} />
      <BitWidthField {...props} />
      <ToggleField
        title="Write Enable Port"
        hint="Disable for always-write registers"
        checked={props.config.hasWriteEnable ?? true}
        onToggle={(hasWriteEnable) => props.onChange({ hasWriteEnable })}
      />
    </div>
  );
}

export function MuxComponentConfigPanel(props: PanelProps) {
  return (
    <div className="flex flex-col gap-3">
      <NameField {...props} />
      <BitWidthField {...props} />
      <div className="flex flex-col gap-1">
        <label className="t-section">
          Number of Inputs
        </label>
        <select
          value={props.config.numInputs ?? 2}
          onChange={(e) => props.onChange({ numInputs: Number(e.target.value) })}
          className="h-9 rounded-lg border border-line bg-sunken px-3 text-sm text-fg transition-colors focus:border-line-strong focus:outline-none"
        >
          <option value={2}>2 inputs</option>
          <option value={3}>3 inputs</option>
        </select>
      </div>
    </div>
  );
}

export function ConstantComponentConfigPanel(props: PanelProps) {
  return (
    <div className="flex flex-col gap-3">
      <NameField {...props} />
      <BitWidthField {...props} />
      <div className="flex flex-col gap-1">
        <label className="t-section">
          Constant Value (N)
        </label>
        <input
          type="number"
          value={props.config.constantValue ?? 1}
          onChange={(e) => props.onChange({ constantValue: Number(e.target.value) })}
          className="h-9 rounded-lg border border-line bg-sunken px-3 text-sm text-fg transition-colors focus:border-line-strong focus:outline-none"
        />
      </div>
    </div>
  );
}

export function IncrementerComponentConfigPanel(props: PanelProps) {
  return (
    <div className="flex flex-col gap-3">
      <NameField {...props} />
      <BitWidthField {...props} />
      <div className="flex flex-col gap-1">
        <label className="t-section">
          Step (added to the input)
        </label>
        <input
          type="number"
          value={props.config.step ?? 1}
          onChange={(e) => props.onChange({ step: Number(e.target.value) })}
          className="h-9 rounded-lg border border-line bg-sunken px-3 text-sm text-fg transition-colors focus:border-line-strong focus:outline-none"
        />
      </div>
    </div>
  );
}

// ── Dispatcher ────────────────────────────────────────────────────────────

/**
 * Applies to every component type, so it lives outside the per-type switch.
 * Top and bottom ports (control signals) are unaffected — only left/right swap.
 */
function MirrorPortsField({ config, onChange }: PanelProps) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span className="t-section">Mirror port sides</span>
      <input
        type="checkbox"
        checked={config.mirrorPorts ?? false}
        onChange={(e) => onChange({ mirrorPorts: e.target.checked })}
        className="h-4 w-4 accent-[var(--st-active)]"
      />
    </label>
  );
}

export function ConfigPanelForType({ type, ...props }: PanelProps & { type: string }) {
  return (
    <>
      <TypeSpecificPanel type={type} {...props} />
      <MirrorPortsField {...props} />
    </>
  );
}

function TypeSpecificPanel({
  type,
  ...props
}: PanelProps & { type: string }) {
  switch (type) {
    case "GprComponent":
      return <GprComponentConfigPanel {...props} />;
    case "MemoryComponent":
      return <MemoryComponentConfigPanel {...props} />;
    case "InstructionMemoryComponent":
      return <InstructionMemoryComponentConfigPanel {...props} />;
    case "UlaComponent":
      return <UlaComponentConfigPanel {...props} />;
    case "Register":
    case "PipelineRegister":
      return <RegisterComponentConfigPanel {...props} />;
    case "MuxComponent":
      return <MuxComponentConfigPanel {...props} />;
    case "ConstantComponent":
      return <ConstantComponentConfigPanel {...props} />;
    case "IncrementerComponent":
      return <IncrementerComponentConfigPanel {...props} />;
    default:
      return <NameField {...props} />;
  }
}
