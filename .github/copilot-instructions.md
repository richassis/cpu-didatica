# Copilot instructions for `cpu-didatica`

## Build, lint, and test commands

- Install deps: `npm install`
- Run dev server: `npm run dev`
- Run lint: `npm run lint`
- Build production bundle: `npm run build`
- Start production server: `npm run start`

Testing:

- There is currently no `npm test` script and no test files in the repository.
- Single-test execution is not available yet (no configured test runner).

Useful targeted checks while editing:

- Lint a specific file: `npx eslint path/to/file.tsx`

## High-level architecture

This is a Next.js App Router app with two main pages:

- `app/page.tsx`: main simulator workspace
- `app/config/page.tsx`: lightweight configuration/help screen

The simulator is split into three layers:

1. UI/canvas layer (`components/*`)
- `SimulatorCanvas.tsx` renders a large virtual canvas with drag/drop (`@dnd-kit/core`), zoom, overlays, and toolbars.
- `WidgetRenderer.tsx` dispatches each `ComponentInstance.type` to the concrete widget component.
- `AddComponentModal`, `ConfigModal`, and `ConnectionModal` manage component creation/configuration and bus wiring UX.

2. Persisted layout/project layer (Zustand stores)
- `lib/store.ts` (`useLayoutStore`): persisted canvas/layout state (`components`, `zoom`, persisted `wires`, viewport positioning).
- `lib/projectStore.ts` (`useProjectStore`): persisted multi-tab project management and `.cpud` import/export.
- `lib/displayStore.ts` (`useDisplayStore`): persisted display preferences (numeric base).

3. Runtime simulation/domain layer
- `lib/simulatorStore.ts` (`useSimulatorStore`): non-persisted class instances and runtime orchestration.
- `lib/simulator/*`: domain classes (`CPU`, `Decoder`, `Memory`, `Register`, `Mux`, `Bus`, `Port`, etc.).
- `Bus`/`Wire`/`Port` enforce port direction/type compatibility and represent runtime signal propagation.

State synchronization flow:

- Adding/removing/moving widgets is initiated from UI components and written into `useLayoutStore`.
- `useLayoutStore` creates/removes corresponding runtime objects in `useSimulatorStore`.
- `useSimulatorStore` persists runtime snapshots/wires back to `useLayoutStore` after ticks and wiring changes.
- `app/page.tsx` coordinates active project tabs with layout/runtime hydration when switching tabs.

## Key codebase conventions

- **Component type strings are contracts**: `ComponentInstance.type` must match across:
  - `lib/widgetDefinitions.ts` (`WIDGET_DEFINITIONS`)
  - `components/WidgetRenderer.tsx` switch cases
  - `lib/simulatorStore.ts` object creation switch
  Missing one of these breaks rendering or runtime object creation.

- **Two persistence formats coexist intentionally**:
  - Tab/project import/export uses `.cpud` via `projectStore` (`ProjectData`).
  - Canvas snapshot save/load in `SimulatorCanvas`/`useLayoutStore` uses JSON `ProjectSnapshot` with `version: 1`.
  Keep both flows working unless explicitly asked to unify them.

- **Runtime objects are never persisted directly**:
  - `useSimulatorStore` holds class instances in memory only.
  - Persisted state must stay plain JSON in layout/project stores (`components`, `wires`, `state` payloads).

- **Wire and component lifecycle are coupled**:
  - Create/remove components through store actions so bus registration/unregistration stays in sync.
  - Do not mutate `objects` or `wires` maps directly.

- **Hydration and tab switching are explicit**:
  - `app/page.tsx` waits for client hydration (`isHydrated`) before loading tab data.
  - Tab switching clears runtime objects, restores components, then restores wires after object recreation.

- **Aliases and typing**:
  - Use `@/*` path alias from `tsconfig.json`.
  - Keep strict TypeScript types; avoid `any`/unsafe casts where possible.
