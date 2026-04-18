import { useEffect, useState } from "react";
import SimulatorCanvas from "@/components/SimulatorCanvas";
import TopBar from "@/components/TopBar";
import { useProjectStore } from "@/lib/projectStore";
import { useLayoutStore } from "@/lib/store";
import { useSimulatorStore } from "@/lib/simulatorStore";

export default function Home() {
  const activeTabId = useProjectStore((s) => s.activeTabId);
  const projectData = useProjectStore((s) => s.projectData);
  const updateProjectData = useProjectStore((s) => s.updateProjectData);
  const markDirty = useProjectStore((s) => s.markDirty);
  const loadDefaultProject = useProjectStore((s) => s.loadDefaultProject);
  
  const layoutComponents = useLayoutStore((s) => s.components);
  const setComponents = useLayoutStore.setState;
  
  const restoreWires = useSimulatorStore((s) => s.restoreWires);
  const clearObjects = useSimulatorStore((s) => s.clearObjects);
  const createObject = useSimulatorStore((s) => s.createObject);

  const [isHydrated, setIsHydrated] = useState(false);

  // Wait for hydration
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Load default project data if needed
  useEffect(() => {
    if (!isHydrated || !activeTabId) return;
    
    // If active tab is default project but data not loaded, load it
    if (activeTabId === 'default' && !projectData[activeTabId]) {
      loadDefaultProject();
    }
  }, [isHydrated, activeTabId, projectData, loadDefaultProject]);

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
      wires: data.wires,
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
      <TopBar />
      <SimulatorCanvas />
    </div>
  );
}