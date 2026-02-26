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
  // Future per-type fields go here (e.g. registerValue, memorySize, …)
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
  return <NameField {...props} />;
}

export function UlaComponentConfigPanel(props: PanelProps) {
  return <NameField {...props} />;
}

export function RegisterComponentConfigPanel(props: PanelProps) {
  return <NameField {...props} />;
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
    case "UlaComponent":
      return <UlaComponentConfigPanel {...props} />;
    case "Register":
      return <RegisterComponentConfigPanel {...props} />;
    default:
      return <NameField {...props} />;
  }
}
