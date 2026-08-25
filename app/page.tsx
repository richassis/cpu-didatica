"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import SimulatorCanvas from "@/components/SimulatorCanvas";
import { ProgramModeLayout } from "@/components/ProgramMode";
import TopBar from "@/components/TopBar";
import { useProjectStore } from "@/lib/projectStore";
import { useLayoutStore } from "@/lib/store";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { useModeStore } from "@/lib/modeStore";
import { DEFAULT_PROJECT_ID, isDefaultProject } from "@/lib/defaultProject";
import { EDITOR_ENABLED } from "@/lib/editorFlag";
import { purgeLegacyStorage } from "@/lib/legacyStorage";
import type { WireDescriptor } from "@/lib/simulator";

export default function Home() {
  const activeTabId = useProjectStore((s) => s.activeTabId);
  const projectData = useProjectStore((s) => s.projectData);
  const updateProjectData = useProjectStore((s) => s.updateProjectData);
  const loadDefaultProject = useProjectStore((s) => s.loadDefaultProject);
  
  const layoutComponents = useLayoutStore((s) => s.components);
  const setLayoutState = useLayoutStore.setState;
  
  const restoreWires = useSimulatorStore((s) => s.restoreWires);
  const getWires = useSimulatorStore((s) => s.getWires);
  const clearObjects = useSimulatorStore((s) => s.clearObjects);
  const createObject = useSimulatorStore((s) => s.createObject);
  const applyObjectStates = useSimulatorStore((s) => s.applyObjectStates);
  const setComponentTickSteps = useSimulatorStore((s) => s.setComponentTickSteps);
  const setComponentTickOrderByState = useSimulatorStore((s) => s.setComponentTickOrderByState);
  const getComponentTickSteps = useSimulatorStore((s) => s.getComponentTickSteps);
  const getComponentTickOrderByState = useSimulatorStore((s) => s.getComponentTickOrderByState);
  const mode = useModeStore((s) => s.mode);

  /**
   * False while the server renders and through the first client render, true
   * afterwards — everything below reads localStorage or the simulator objects,
   * neither of which exists on the server.
   *
   * `useSyncExternalStore` with a never-firing subscription rather than the
   * usual `useState` + mount effect: it gives the same answer without a
   * setState in an effect, and so without the cascading render that pattern
   * costs on every load.
   */
  const isHydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const previousActiveTabRef = useRef<string | null>(null);
  const pendingHydrationTabRef = useRef<string | null>(null);
  const lastDefaultPersistRef = useRef<string | null>(null);

  // Drop keys older builds wrote and nothing reads any more.
  useEffect(() => {
    purgeLegacyStorage();
  }, []);

  // Load default project data if needed
  useEffect(() => {
    if (!isHydrated || !activeTabId) return;
    
    // If active tab is default project but data not loaded, load it
    if (isDefaultProject(activeTabId) && !projectData[activeTabId]) {
      loadDefaultProject();
    }
  }, [isHydrated, activeTabId, projectData, loadDefaultProject]);

  // Sync layout store with project data when switching tabs
  useEffect(() => {
    if (!isHydrated) return;

    if (!activeTabId) {
      previousActiveTabRef.current = null;
      pendingHydrationTabRef.current = null;
      return;
    }

    if (previousActiveTabRef.current !== activeTabId) {
      previousActiveTabRef.current = activeTabId;
      pendingHydrationTabRef.current = activeTabId;
    }

    if (pendingHydrationTabRef.current !== activeTabId) {
      return;
    }

    const data = projectData[activeTabId];
    if (!data) return;

    // Clear runtime state before loading selected project.
    clearObjects();
    
    // Hydrate layout state from project snapshot.
    setLayoutState((state) => ({
      ...state,
      components: data.components,
      wires: data.wires,
      canvasSize: data.canvasSize,
      zoom: data.zoom,
    }));

    // Recreate runtime objects synchronously.
    for (const comp of data.components) {
      createObject(comp.id, comp.type, comp.label, comp.meta);
    }

    for (const comp of data.components) {
      if (comp.tickSteps) {
        setComponentTickSteps(comp.id, comp.tickSteps);
      }
      if (comp.tickOrderByState) {
        setComponentTickOrderByState(comp.id, comp.tickOrderByState);
      }
    }

    restoreWires(data.wires);

    const stateEntries = data.components
      .filter((component) => component.state)
      .map((component) => [component.id, component.state!] as const);

    if (stateEntries.length > 0) {
      applyObjectStates(new Map(stateEntries));
    }

    pendingHydrationTabRef.current = null;
  }, [
    activeTabId,
    isHydrated,
    projectData,
    clearObjects,
    createObject,
    setComponentTickSteps,
    setComponentTickOrderByState,
    restoreWires,
    applyObjectStates,
    setLayoutState,
  ]);

  // Persist current runtime/layout state into the active project.
  //
  // Authoring only. In a published build the layout never changes — it is read
  // from the shipped file and displayed — so there is nothing to write back,
  // and this guard is what keeps the whole save path (including the
  // `/api/default-project` URL) out of the student's bundle.
  useEffect(() => {
    if (!EDITOR_ENABLED) return;
    if (!isHydrated || !activeTabId) return;

    const saveState = () => {
      const runtimeWires = getWires();
      const projectWires = useProjectStore.getState().projectData[activeTabId]?.wires ?? [];

      // If runtime wires are empty but project wires exist, skip to avoid wiping wires
      // during hydration or when a wire restore fails.
      if (runtimeWires.length === 0 && projectWires.length > 0) {
        return;
      }

      const nodesById = new Map(projectWires.map((wire) => [wire.id, wire.nodes ?? []]));

      const enhancedComponents = layoutComponents.map((component) => {
        const tickSteps = getComponentTickSteps(component.id);
        const tickOrderByState = getComponentTickOrderByState(component.id);

        return {
          ...component,
          ...(tickSteps ? { tickSteps } : {}),
          ...(tickOrderByState && Object.keys(tickOrderByState).length > 0 ? { tickOrderByState } : {}),
        };
      });

      const wires: WireDescriptor[] = runtimeWires.map((wire) => ({
        ...wire,
        nodes: nodesById.get(wire.id) ?? wire.nodes ?? [],
      }));

      updateProjectData(activeTabId, {
        components: enhancedComponents,
        wires,
      });

      if (activeTabId === DEFAULT_PROJECT_ID && mode === "edit") {
        const currentProject = useProjectStore.getState().projectData[activeTabId];
        if (currentProject) {
          const payload = {
            ...currentProject,
            components: enhancedComponents,
            wires,
            updatedAt: new Date().toISOString(),
          };
          const serialized = JSON.stringify(payload);
          if (lastDefaultPersistRef.current !== serialized) {
            lastDefaultPersistRef.current = serialized;
            fetch("/api/default-project", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: serialized,
            }).catch((error) => {
              console.warn("Failed to persist default project:", error);
            });
          }
        }
      }

      setLayoutState((state) => ({
        ...state,
        wires,
      }));
    };

    // Debounced save
    const timeout = setTimeout(saveState, 500);
    return () => clearTimeout(timeout);
  }, [layoutComponents, activeTabId, isHydrated, updateProjectData, getWires, setLayoutState, getComponentTickSteps, getComponentTickOrderByState, mode]);

  if (!isHydrated) {
    return (
      <div className="flex flex-1 items-center justify-center bg-canvas">
        <div className="text-sm text-fg-muted">Carregando…</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <TopBar />
      {EDITOR_ENABLED && mode === "edit" ? <SimulatorCanvas /> : <ProgramModeLayout />}
    </div>
  );
}