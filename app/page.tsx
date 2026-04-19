"use client";

import { useEffect, useRef, useState } from "react";
import SimulatorCanvas from "@/components/SimulatorCanvas";
import TopBar from "@/components/TopBar";
import { useProjectStore } from "@/lib/projectStore";
import { useLayoutStore } from "@/lib/store";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { isDefaultProject } from "@/lib/defaultProject";
import { enforceOrthogonal, simplifyOrthogonalPath } from "@/lib/wireRouting";
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

  const [isHydrated, setIsHydrated] = useState(false);
  const previousActiveTabRef = useRef<string | null>(null);
  const pendingHydrationTabRef = useRef<string | null>(null);

  // Wait for hydration
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Load default project data if needed
  useEffect(() => {
    if (!isHydrated || !activeTabId) return;
    
    // If active tab is default project but data not loaded, load it
    if (isDefaultProject(activeTabId) && !projectData[activeTabId]) {
      loadDefaultProject();
    }
  }, [isHydrated, activeTabId, projectData, loadDefaultProject]);

  // Migrate legacy enhanced wire storage into the currently active project once.
  useEffect(() => {
    if (!isHydrated || !activeTabId) return;

    const raw = window.localStorage.getItem("enhanced-wire-storage");
    if (!raw) return;

    const current = projectData[activeTabId];
    if (!current) return;

    try {
      const parsed = JSON.parse(raw) as {
        state?: { wires?: Array<Record<string, unknown>> };
        wires?: Array<Record<string, unknown>>;
      };

      const legacyWires = parsed.state?.wires ?? parsed.wires ?? [];
      if (legacyWires.length === 0) {
        window.localStorage.removeItem("enhanced-wire-storage");
        return;
      }

      const mergedWires = [...current.wires];
      let changed = false;

      for (const legacy of legacyWires) {
        const start = legacy.start as { componentId?: string; portName?: string; direction?: string } | undefined;
        const end = legacy.end as { componentId?: string; portName?: string; direction?: string } | null | undefined;

        if (!start || !end) continue;

        let source = start;
        let target = end;

        if (start.direction === "input" && end.direction === "output") {
          source = end;
          target = start;
        }

        if (!source.componentId || !source.portName || !target.componentId || !target.portName) {
          continue;
        }

        const index = mergedWires.findIndex(
          (wire) =>
            wire.sourceComponentId === source.componentId &&
            wire.sourcePortName === source.portName &&
            wire.targetComponentId === target.componentId &&
            wire.targetPortName === target.portName
        );

        if (index < 0) continue;

        const existingNodes = mergedWires[index].nodes ?? [];
        if (existingNodes.length > 0) continue;

        const legacyNodes = ((legacy.nodes as Array<{ x?: number; y?: number }> | undefined) ?? [])
          .filter((node) => typeof node.x === "number" && typeof node.y === "number")
          .map((node) => ({ x: node.x as number, y: node.y as number }));

        if (legacyNodes.length === 0) continue;

        mergedWires[index] = {
          ...mergedWires[index],
          nodes: simplifyOrthogonalPath(enforceOrthogonal(legacyNodes)),
        };
        changed = true;
      }

      if (changed) {
        updateProjectData(activeTabId, { wires: mergedWires });
      }
    } catch (error) {
      console.warn("Failed to migrate enhanced wire storage:", error);
    } finally {
      window.localStorage.removeItem("enhanced-wire-storage");
    }
  }, [isHydrated, activeTabId, projectData, updateProjectData]);

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
    restoreWires,
    applyObjectStates,
  ]);

  // Persist current runtime/layout state into the active project.
  useEffect(() => {
    if (!isHydrated || !activeTabId) return;

    const saveState = () => {
      const runtimeWires = getWires();
      const projectWires = useProjectStore.getState().projectData[activeTabId]?.wires ?? [];
      const nodesById = new Map(projectWires.map((wire) => [wire.id, wire.nodes ?? []]));

      const wires: WireDescriptor[] = runtimeWires.map((wire) => ({
        ...wire,
        nodes: nodesById.get(wire.id) ?? wire.nodes ?? [],
      }));

      updateProjectData(activeTabId, {
        components: layoutComponents,
        wires,
      });

      setLayoutState((state) => ({
        ...state,
        wires,
      }));
    };

    // Debounced save
    const timeout = setTimeout(saveState, 500);
    return () => clearTimeout(timeout);
  }, [layoutComponents, activeTabId, isHydrated, updateProjectData, getWires, setLayoutState]);

  if (!isHydrated) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-950">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <TopBar />
      <SimulatorCanvas />
    </div>
  );
}