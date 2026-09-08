"use client";

import { useState, type ReactNode, type CSSProperties } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Settings2 } from "lucide-react";
import type { ComponentInstance } from "@/lib/store";
import { useNodeState, type NodeState } from "@/lib/useNodeState";
import ConfigModal from "@/components/ConfigModal";
import { useCanvasEditing } from "@/components/CanvasEditingContext";
import { EDITOR_ENABLED } from "@/lib/editorFlag";
import PortsOverlay from "@/components/PortsOverlay";
import {
  Silhouette,
  ClockNotch,
  MemorySpine,
  GLYPHS,
  type SilhouetteKind,
} from "@/components/widgets/silhouettes";

interface NodeShellProps {
  component: ComponentInstance;
  zoom: number;
  /**
   * Force a state instead of deriving it from the tick. Only for conditions
   * the animation cannot know about — a halted CPU, a bad address.
   */
  state?: NodeState;
  /**
   * Non-rectangular outline. Omit for a plain rounded rectangle; pass
   * "custom" when the widget draws its own outline into `frame` because its
   * geometry has to line up with real port coordinates.
   */
  silhouette?: SilhouetteKind | "custom";
  /**
   * Custom outline layer, drawn under everything and never hidden by the LOD
   * rules — a silhouette has to survive all the way down to 25%.
   */
  frame?: ReactNode;
  /** Sequential component: gets the clock notch. */
  sequential?: boolean;
  /** Memory: gets the spine on the left border. */
  spine?: boolean;
  /** Control unit: dashed outline. Reserved for exactly one component type. */
  control?: boolean;
  /**
   * The node's headline value. Kept out of `children` on purpose: it survives
   * down to 50% zoom, while the anatomy does not.
   */
  value?: ReactNode;
  /**
   * Treat `value` as a stand-in that steps aside once the anatomy is visible.
   * For nodes whose real content is a table or a list, where the headline just
   * repeats one row of it. Leave off when the headline is the content — the
   * CPU's phase, the decoder's mnemonic, the MUX's selected value.
   */
  compactValue?: boolean;
  /** Extra controls in the title row, left of the config button. */
  actions?: ReactNode;
  /** Internal anatomy. Hidden below 100% zoom by the LOD rules. */
  children?: ReactNode;
  /**
   * Anatomy that stays visible at `mid` zoom instead of only `full` — for
   * content the LOD rules exist to reveal in the first place (address lists,
   * the FSM graph, the signal strip), rather than incidental detail that is
   * fine to lose first. Still hidden at `low`.
   */
  dense?: boolean;
}

/**
 * Everything every node on the canvas has in common: placement, dragging,
 * state, corner badge, title, ports and the config modal.
 *
 * Before this existed each of the twelve widgets carried its own copy of the
 * dnd-kit boilerplate and its own colour ternaries, which is how the canvas
 * ended up with eleven identity hues and no way to show what a tick was doing.
 * Appearance now hangs off `data-state` and is resolved entirely in CSS
 * (see the node block in globals.css) — a widget's only job is its anatomy.
 */
export default function NodeShell({
  component,
  zoom,
  state,
  silhouette,
  frame,
  sequential = false,
  spine = false,
  control = false,
  value,
  compactValue = false,
  actions,
  children,
  dense = false,
}: NodeShellProps) {
  const { id, x, y, w, h, label, type } = component;
  const [configOpen, setConfigOpen] = useState(false);
  const derivedState = useNodeState(id);
  const nodeState = state ?? derivedState;

  // Everything below that can change the datapath hangs off this. The shell
  // used to offer all of it unconditionally, which is how a read-only canvas
  // still handed out "Remove component" on a double-click.
  const editing = useCanvasEditing();

  // The hook is called unconditionally — rules of hooks — and made inert with
  // dnd-kit's own `disabled` flag rather than by withholding its listeners.
  //
  // `data-draggable` stays on the element in both modes: the canvas click
  // handler reads it to decide what does *not* deselect a wire.
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    disabled: !editing,
  });
  // The canvas is CSS-scaled, so dnd-kit's pixel delta has to be divided back
  // out or the node races ahead of the cursor at any zoom other than 100%.
  const correctedTransform = transform
    ? { ...transform, x: transform.x / zoom, y: transform.y / zoom }
    : null;

  const style: CSSProperties = {
    position: "absolute",
    left: x,
    top: y,
    width: w,
    height: h,
    transform: CSS.Translate.toString(correctedTransform),
    zIndex: isDragging ? 50 : 10,
    // `touchAction: none` exists to stop the browser panning while a node is
    // dragged. On a read-only canvas there is no drag, and it would only mean
    // a tablet cannot scroll with a finger on top of a component.
    touchAction: editing ? "none" : undefined,
  };

  const Glyph = GLYPHS[type];

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...(editing ? listeners : {})}
        {...(editing ? attributes : {})}
        data-draggable
        data-state={nodeState}
        className={`node group relative flex select-none flex-col ${
          editing ? "cursor-grab active:cursor-grabbing" : ""
        } ${silhouette ? "" : "node--boxed"} ${control ? "node--control" : ""}`}
        onDoubleClick={
          editing
            ? (e) => {
                e.stopPropagation();
                setConfigOpen(true);
              }
            : undefined
        }
        title={label}
      >
        {silhouette && silhouette !== "custom" && <Silhouette kind={silhouette} />}
        {frame}
        {spine && <MemorySpine />}
        {sequential && <ClockNotch />}

        {/* Badge notched into the top-left corner. It replaces the full-width
            coloured header bar every node used to carry — that bar spent a
            large block of saturated colour on identity alone. */}
        {Glyph && (
          <div
            className="node-badge absolute left-0 top-0 z-10 flex h-5 w-5 items-center justify-center rounded-br-md border-b border-r"
            aria-hidden
          >
            <Glyph size={12} strokeWidth={1.5} />
          </div>
        )}

        <div className="relative z-10 flex shrink-0 items-center gap-1 pl-6 pr-1 pt-0.5">
          <span className="node-title t-node min-w-0 flex-1 truncate leading-none">{label}</span>
          {actions}
          {editing && (
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setConfigOpen(true);
              }}
              className="shrink-0 rounded p-0.5 text-fg-faint opacity-0 transition-opacity hover:text-fg focus-visible:opacity-100 group-hover:opacity-100"
              aria-label={`Configure ${label}`}
            >
              <Settings2 size={12} strokeWidth={1.5} />
            </button>
          )}
        </div>

        {value !== undefined && (
          <div
            className={`node-value t-value relative z-10 flex items-center justify-center px-2 ${
              children ? "shrink-0" : "flex-1"
            } ${compactValue ? "node-value--compact" : ""}`}
          >
            {value}
          </div>
        )}

        {children && (
          <div
            className={`node-anatomy relative z-10 flex min-h-0 flex-1 flex-col ${
              dense ? "node-anatomy--dense" : ""
            }`}
          >
            {children}
          </div>
        )}

        <PortsOverlay componentId={id} />
      </div>
      {/* `EDITOR_ENABLED` is redundant with `editing` at runtime — the provider
          already folds it in — but stating it here is a literal the bundler can
          fold, which is what keeps ConfigModal out of the student's bundle. */}
      {EDITOR_ENABLED && editing && configOpen && (
        <ConfigModal component={component} onClose={() => setConfigOpen(false)} />
      )}
    </>
  );
}
