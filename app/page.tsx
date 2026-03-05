"use client";

import { useEffect, useState } from "react";
import SimulatorCanvas from "@/components/SimulatorCanvas";
import ProjectTabBar from "@/components/ProjectTabBar";
import WelcomeModal from "@/components/WelcomeModal";
import { useProjectStore } from "@/lib/projectStore";
import { useLayoutStore } from "@/lib/store";
import { useSimulatorStore } from "@/lib/simulatorStore";

export default function Home() {
  const tabs = useProjectStore((s) => s.tabs);
  const activeTabId = useProjectStore((s) => s.activeTabId);
  const showWelcome = useProjectStore((s) => s.showWelcome);
  const setShowWelcome = useProjectStore((s) => s.setShowWelcome);
  const projectData = useProjectStore((s) => s.projectData);
  const updateProjectData = useProjectStore((s) => s.updateProjectData);
  const markDirty = useProjectStore((s) => s.markDirty);
  
  const layoutComponents = useLayoutStore((s) => s.components);
  const setComponents = useLayoutStore.setState;
  const clearComponents = useLayoutStore((s) => s.clearComponents);
  
  const restoreWires = useSimulatorStore((s) => s.restoreWires);
  const clearObjects = useSimulatorStore((s) => s.clearObjects);
  const createObject = useSimulatorStore((s) => s.createObject);

  const [isHydrated, setIsHydrated] = useState(false);

  // Wait for hydration
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Sync layout store with project data when switching tabs
  useEffect(() => {
    if (!isHydrated || !activeTabId) return;
    
    const data = projectData[activeTabId];
    if (!data) return;

    // Clear current state
    clearObjects();
    
    // Load components from project
    setComponents((state) => ({
      ...state,
      components: data.components,
      canvasSize: data.canvasSize,
      zoom: data.zoom,
    }));

    // Recreate data objects
    for (const comp of data.components) {
      createObject(comp.id, comp.type, comp.label);
    }

    // Restore wires after a small delay to ensure objects are ready
    setTimeout(() => {
      restoreWires(data.wires);
    }, 100);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId, isHydrated]);

  // Save current state to project data periodically
  useEffect(() => {
    if (!isHydrated || !activeTabId) return;

    const saveState = () => {
      const wires = useSimulatorStore.getState().getWires();
      updateProjectData(activeTabId, {
        components: layoutComponents,
        wires,
      });
    };

    // Debounced save
    const timeout = setTimeout(saveState, 500);
    return () => clearTimeout(timeout);
  }, [layoutComponents, activeTabId, isHydrated, updateProjectData]);

  // Mark dirty on component changes
  useEffect(() => {
    if (!isHydrated || !activeTabId) return;
    if (layoutComponents.length > 0) {
      markDirty(activeTabId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutComponents, activeTabId, isHydrated]);

  if (!isHydrated) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-950">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <ProjectTabBar />
      
      {tabs.length > 0 && activeTabId ? (
        <SimulatorCanvas />
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gray-950">
          <div className="text-center">
            <div className="text-6xl mb-4">🖥️</div>
            <h2 className="text-xl font-semibold text-gray-300 mb-2">No Project Open</h2>
            <p className="text-gray-500 mb-4">Create a new project to get started</p>
            <button
              onClick={() => setShowWelcome(true)}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors"
            >
              Create Project
            </button>
          </div>
        </div>
      )}

      <WelcomeModal 
        isOpen={showWelcome && tabs.length === 0} 
        onClose={() => setShowWelcome(false)} 
      />
    </div>
  );
}