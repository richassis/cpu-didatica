# CPU Didática — Interface Reformulation Plan

## Goal

Restructure the simulator so that **Program Mode is the primary experience** for end users, while **Edit Mode is a secondary, developer-facing tool**. Remove the redundant "Simulate" mode. Add data import/export (memory + GPR) and assembly import/export in Program Mode.

---

## Current State Summary

| Concern | Current Behaviour |
|---|---|
| Modes | `edit` / `simulation` (ModeStore) + `isProgramMode` (ExecutionStore) — three overlapping states |
| Entry point | Edit canvas is shown first; Program Mode is a hidden button in TopBar |
| TopBar | Has `ProjectSwitcher`, `ModeToggle` (Edit/Simulate), and a `▶ Program Mode` button |
| Program Mode | Full-screen layout: `ProgramEditor` sidebar + `DatapathViewer` + `ExecutionTimeline` |
| Simulate mode | Locks editing, captures snapshot for reset; adds no distinct UI value for end users |
| File I/O | Save/import/export `.cpud` project files — only accessible in Edit mode via `ProjectSwitcher` |
| Data I/O | None — no way to export/import memory/GPR state |
| Assembly | `loadTestProgram()` hard-codes instructions; `ProgramEditor` textarea is disabled (placeholder) |

---

## Target State Summary

| Concern | Target Behaviour |
|---|---|
| Default view | **Program Mode** — the canvas with the default datapath, execution controls, and assembly editor |
| Edit Mode | Secondary, unlocked via a clearly labelled "Developer / Edit" toggle or button |
| Simulate mode | **Removed** — tick/reset controls exist in both modes as needed |
| TopBar (Program) | App title, Program Mode controls (load/run/step/reset), Data I/O buttons, Assembly I/O buttons |
| TopBar (Edit) | App title, ProjectSwitcher, Edit-mode label, back-to-Program button |
| Data file (`.cpudat`) | JSON containing GPR register values + memory cell arrays; importable/exportable in Program Mode |
| Assembly file (`.s` or `.asm`) | Plain-text assembly source; importable/exportable in Program Mode |
| Default project | Loads silently on first visit; never shown as a tab or switcher in Program Mode |

---

## Detailed File-by-File Changes

---

### 1. `lib/modeStore.ts` — Simplify to two modes

**Remove** `simulation` mode entirely. Rename modes to `program` (default) and `edit`.

```ts
// BEFORE
export type SimulatorMode = "edit" | "simulation";

// AFTER
export type SimulatorMode = "program" | "edit";
```

- Remove `enterSimulationMode`, `getSnapshot`, snapshot logic.
- Keep `enterEditMode` / `enterProgramMode`.
- Remove `SimulationSnapshot` interface.
- Update `useCanEdit()` and `useCanSimulate()` helpers to `useIsEditMode()` / `useIsProgramMode()`.

---

### 2. `lib/executionStore.ts` — No structural change needed

`isProgramMode` in `executionStore` tracks whether a program has been loaded and snapshots exist for timeline replay. This is **separate** from the UI mode in `modeStore`. Keep as-is but rename the flag to `isTimelineActive` to reduce confusion with the new primary "program mode" concept.

- Rename `isProgramMode` → `isTimelineActive` throughout.
- Rename `exitProgramMode` → `exitTimeline`.
- Update all consumers: `TopBar`, `SimulatorCanvas`, `ProgramModeLayout`, `app/page.tsx`.

---

### 3. `app/page.tsx` — Change default mode

```ts
// The initial mode should be "program", not "edit"
// modeStore initialises to "edit" — change default:
```

In `lib/modeStore.ts`, change:
```ts
mode: "edit",   // BEFORE
mode: "program", // AFTER
```

In `app/page.tsx`, the conditional render currently switches on `isProgramMode` from `executionStore`. Replace with mode from `modeStore`:

```ts
// BEFORE
{isProgramMode ? <ProgramModeLayout /> : <SimulatorCanvas />}

// AFTER
{mode === "edit" ? <EditLayout /> : <ProgramModeLayout />}
```

Where `ProgramModeLayout` becomes the default view (no timeline required to show it), and `EditLayout` wraps `SimulatorCanvas`.

---

### 4. `components/TopBar.tsx` — Two distinct top bars

Split into two components:

#### `components/TopBarProgram.tsx` (new)

Shown when `mode === "program"`.

Left side:
- App name/logo: **"CPU Didática"**
- No project switcher (end users don't manage projects)

Centre:
- Assembly controls: `[Import .asm]` `[Export .asm]`
- Data controls: `[Import Data]` `[Export Data]`

Right side:
- `[▶ Run]` button — loads assembly into IMEM and runs to HLT, activating timeline
- `[Edit Mode]` button (small, secondary style) — switches to edit

#### `components/TopBarEdit.tsx` (new)

Shown when `mode === "edit"`.

Left side:
- `[← Program Mode]` button
- `ProjectSwitcher` (existing component, unchanged)

Right side:
- `ModeToggle` removed — replaced by the back button above

#### `components/TopBar.tsx` (updated)

Becomes a router:
```tsx
export default function TopBar() {
  const mode = useModeStore(s => s.mode);
  return mode === "edit" ? <TopBarEdit /> : <TopBarProgram />;
}
```

---

### 5. `components/ModeToggle.tsx` — Delete

No longer needed. Mode switching is handled by explicit buttons in each TopBar variant.

---

### 6. `components/ProgramMode/ProgramModeLayout.tsx` — Restructure

Current layout: `ProgramEditor` sidebar (280px) + `DatapathViewer` (canvas) + `ExecutionTimeline` (fixed bottom).

New layout:

```
┌─────────────────────────────────────────────────────────┐
│  TopBarProgram (assembly I/O, data I/O, run button)     │
├──────────────┬──────────────────────────────────────────┤
│              │                                          │
│  Assembly    │   Datapath Canvas (read-only)            │
│  Editor      │   (SimulatorCanvas isReadOnly=true)      │
│  Panel       │                                          │
│  (300px)     │                                          │
│              │                                          │
├──────────────┴──────────────────────────────────────────┤
│  ExecutionTimeline (only visible when isTimelineActive) │
└─────────────────────────────────────────────────────────┘
```

- Timeline panel `pb-24` padding only when `isTimelineActive`.
- Assembly panel shows text editor + run/stop controls.
- Canvas fills remaining space.

---

### 7. `components/ProgramMode/ProgramEditor.tsx` — Activate assembly editor

Currently the textarea is `disabled` with a placeholder warning. Replace with a working controlled textarea:

```tsx
const [source, setSource] = useState("");

<textarea
  value={source}
  onChange={e => setSource(e.target.value)}
  className="..."
  placeholder="; Enter assembly here&#10;; LDAI R0, #5&#10;; HLT"
/>
```

Add:
- `handleImportAsm(file: File)` — reads `.asm`/`.s` file text, sets `source`.
- `handleExportAsm()` — triggers download of `source` as `program.asm`.
- Pass `source` to the run handler for future assembler integration.
- Keep the "assembler em desenvolvimento" warning but make it non-blocking.

Import/export buttons live in `TopBarProgram` and call handlers surfaced via a React context or Zustand slice (see §11).

---

### 8. `components/ProgramMode/DatapathViewer.tsx` — No change needed

Already renders `<SimulatorCanvas isReadOnly />`. Keep as-is.

---

### 9. `components/SimulatorCanvas.tsx` — Guard edit actions on mode

Currently checks `isEditMode` from `useModeStore`. After renaming, update:

```ts
// BEFORE
const isEditMode = mode === "edit" && !isReadOnly;

// AFTER  (same logic, just mode name changed)
const isEditableCanvas = mode === "edit" && !isReadOnly;
```

Remove the FAB items that reference "Simulation mode" (the Reset-to-snapshot logic):

```ts
// BEFORE: handleReset branches on mode === "simulation"
// AFTER: handleReset always calls resetClock() only
const handleReset = () => resetClock();
```

The snapshot-reset feature was only meaningful in the now-removed simulation mode.

---

### 10. New file: `lib/programDataStore.ts`

Zustand slice (not persisted) for Program Mode I/O state:

```ts
interface ProgramDataState {
  // Assembly source
  assemblySource: string;
  setAssemblySource: (src: string) => void;

  // Import assembly from file
  importAssembly: (file: File) => Promise<void>;
  // Export assembly to file
  exportAssembly: () => void;

  // Import data file (.cpudat) → load into GPR + memory
  importData: (file: File) => Promise<void>;
  // Export data file (.cpudat) ← read from GPR + memory
  exportData: () => void;
}
```

#### Data file format (`.cpudat`)

```json
{
  "version": 1,
  "gpr": {
    "<componentId>": [0, 0, 0, 0, 0, 0, 0, 0]
  },
  "memory": {
    "<componentId>": [0, 0, 0, ...]
  },
  "instructionMemory": {
    "<componentId>": [0, 0, 0, ...]
  }
}
```

`importData`:
1. Parse JSON.
2. For each GPR entry: call `useSimulatorStore.getState().pokeGprRegister(id, i, value)` for each register.
3. For each memory entry: call `useSimulatorStore.getState().pokeMemory(id, addr, value)` for each cell.
4. For instruction memory: same via `pokeMemory` or a new `pokeInstructionMemory` method (see §12).
5. Call `touch()`.

`exportData`:
1. Read all GPR objects via `serializeObjects()` — filter for `registers` field.
2. Read all Memory/InstructionMemory objects — filter for `cells` field.
3. Build JSON, trigger download as `data.cpudat`.

`importAssembly`:
1. `reader.readAsText(file)` → set `assemblySource`.

`exportAssembly`:
1. Blob from `assemblySource`, download as `program.asm`.

---

### 11. New file: `lib/assembler.ts` (stub)

```ts
/**
 * Stub assembler. Currently maps hard-coded mnemonics.
 * Replace with full parser when assembler is ready.
 */
export function assemble(source: string): number[] | null {
  // Return null if source is empty or assembler not yet implemented.
  // For now, fall back to loadTestProgram() behaviour.
  return null;
}
```

In `ProgramEditor`, if `assemble(source)` returns `null`, fall back to `loadTestProgram()` with a visible notice. When the assembler is implemented, return the encoded word array and load it directly into IMEM.

---

### 12. `lib/simulatorStore.ts` — Add `pokeInstructionMemory`

```ts
pokeInstructionMemory: (id: string, addr: number, value: number) => void;
```

Implementation mirrors `pokeMemory` but operates on `InstructionMemory` instances:

```ts
pokeInstructionMemory: (id, addr, value) => {
  const obj = get().objects.get(id);
  if (obj instanceof InstructionMemory) {
    obj.poke(addr, value);
    set(s => ({ revision: s.revision + 1 }));
    getLayoutStore().getState().saveState();
  }
},
```

---

### 13. `components/ProgramMode/index.ts` — Update exports

Add exports for any new sub-components created (e.g., `AssemblyPanel`).

---

### 14. `components/widgets/InstructionMemoryComponent.tsx` — Minor

No functional change. The component already supports `poke` via `ConfigModal` / `InstructionBuilder`. Ensure `InstructionBuilder` is inaccessible in Program Mode (it is, since `onDoubleClick` and `configOpen` are blocked by `isReadOnly` in `SimulatorCanvas` — verify this is enforced).

---

### 15. `components/ProjectSwitcher.tsx` — Restrict to Edit Mode

Wrap the entire component render in a guard: only mount/show when `mode === "edit"`. Currently it lives in `TopBar` which will be replaced — this is automatically satisfied by the TopBar split in §4.

No code change needed inside the component itself.

---

### 16. `components/ClearCanvasButton.tsx` — Delete or restrict

This floating button appears whenever there are components. It should only appear in Edit Mode. Currently it is not rendered anywhere in the provided files (it is defined but not imported in `SimulatorCanvas` — confirm). If it is unused, delete. If used, add mode guard.

---

## New Component Tree

```
app/page.tsx
├── TopBar
│   ├── TopBarProgram   (mode === "program")
│   └── TopBarEdit      (mode === "edit")
├── ProgramModeLayout   (mode === "program")  ← DEFAULT
│   ├── AssemblyPanel   (left sidebar, 300px)
│   │   └── textarea + import/export buttons
│   ├── DatapathViewer  (SimulatorCanvas isReadOnly)
│   └── ExecutionTimeline (conditional on isTimelineActive)
└── EditLayout          (mode === "edit")
    └── SimulatorCanvas (full edit capabilities)
```

---

## State Flow Changes

### Mode transitions

```
App start
  └─► mode = "program"  (default)
        └─► ProgramModeLayout shown

[Edit Mode button clicked]
  └─► mode = "edit"
        └─► EditLayout shown

[← Program Mode button clicked]
  └─► mode = "program"
        └─► ProgramModeLayout shown
```

### Run flow (Program Mode)

```
User writes/imports assembly
  └─► [Run] button clicked
        ├─► assemble(source) → word array (or fallback to loadTestProgram)
        ├─► load words into IMEM via pokeInstructionMemory
        ├─► resetClock()
        ├─► loadAndExecute() → captures snapshots
        └─► isTimelineActive = true → ExecutionTimeline appears
```

### Data I/O flow

```
[Export Data] clicked
  └─► serializeObjects() → filter GPR + Memory + IMEM
        └─► build .cpudat JSON → download

[Import Data] clicked
  └─► file picker → parse .cpudat
        └─► pokeGprRegister / pokeMemory / pokeInstructionMemory for each entry
              └─► touch() → canvas updates
```

---

## Files to Create

| File | Purpose |
|---|---|
| `lib/programDataStore.ts` | Assembly source + data I/O state and actions |
| `lib/assembler.ts` | Stub assembler (returns null until implemented) |
| `components/TopBarProgram.tsx` | Program-mode top bar |
| `components/TopBarEdit.tsx` | Edit-mode top bar |
| `components/ProgramMode/AssemblyPanel.tsx` | Left sidebar with textarea and controls |

---

## Files to Modify

| File | Change summary |
|---|---|
| `lib/modeStore.ts` | Rename modes; remove simulation snapshot logic |
| `lib/executionStore.ts` | Rename `isProgramMode` → `isTimelineActive`, `exitProgramMode` → `exitTimeline` |
| `lib/simulatorStore.ts` | Add `pokeInstructionMemory` |
| `app/page.tsx` | Default to `program` mode; switch render on `modeStore.mode` |
| `components/TopBar.tsx` | Route to TopBarProgram or TopBarEdit |
| `components/ModeToggle.tsx` | Delete |
| `components/SimulatorCanvas.tsx` | Remove simulation-mode branching in `handleReset`; update mode checks |
| `components/ProgramMode/ProgramModeLayout.tsx` | New layout structure; conditional timeline padding |
| `components/ProgramMode/ProgramEditor.tsx` | Activate textarea; wire to `programDataStore` |
| `components/ProgramMode/ExecutionTimeline.tsx` | Use renamed `isTimelineActive`; rename `exitProgramMode` call |
| `components/ProgramMode/index.ts` | Add new exports |

---

## Files to Delete

| File | Reason |
|---|---|
| `components/ModeToggle.tsx` | Replaced by explicit buttons in each TopBar variant |
| `components/ClearCanvasButton.tsx` | Functionality absorbed into Edit-mode FAB (already in `SimulatorCanvas`) — confirm unused |

---

## Non-Goals (Out of Scope for This Refactor)

- Implementing a full assembler parser — the stub + fallback to `loadTestProgram` is sufficient.
- Changing simulator logic (CPU, Bus, Port, Wire, etc.).
- Changing the default project layout or component positions.
- Multi-project support in Program Mode — end users always see the default datapath.
- Authentication or cloud storage.

---

## Implementation Order

1. **`lib/modeStore.ts`** — rename modes, remove simulation snapshot.
2. **`lib/executionStore.ts`** — rename `isProgramMode` / `exitProgramMode`.
3. **`app/page.tsx`** — wire new mode names, change default to `program`, update render switch.
4. **`components/TopBar.tsx`** + **`TopBarProgram.tsx`** + **`TopBarEdit.tsx`** — split top bar.
5. **`components/ModeToggle.tsx`** — delete.
6. **`components/SimulatorCanvas.tsx`** — remove simulation-mode logic, update mode checks.
7. **`lib/programDataStore.ts`** — new store.
8. **`lib/assembler.ts`** — stub.
9. **`lib/simulatorStore.ts`** — add `pokeInstructionMemory`.
10. **`components/ProgramMode/AssemblyPanel.tsx`** — new component.
11. **`components/ProgramMode/ProgramModeLayout.tsx`** — restructure.
12. **`components/ProgramMode/ProgramEditor.tsx`** — activate textarea, wire store.
13. **`components/ProgramMode/ExecutionTimeline.tsx`** — rename references.
14. **`components/ProgramMode/index.ts`** — update exports.
15. **Smoke-test** each mode transition and the data I/O round-trip.
