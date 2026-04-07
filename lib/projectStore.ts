/**
 * projectStore.ts
 *
 * Manages simulator project tabs. Each tab is a separate simulation
 * with its own components, wires, and state. Projects can be saved
 * to and loaded from .cpud files.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";
import type { ComponentInstance } from "@/lib/store";
import type { WireDescriptor } from "@/lib/simulator";
import { 
  createDefaultProject, 
  createEmptyProject, 
  DEFAULT_PROJECT_ID,
  DEFAULT_PROJECT_NAME,
  isDefaultProject,
} from "./defaultProject";

/** Serializable project data structure */
export interface ProjectData {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  components: ComponentInstance[];
  wires: WireDescriptor[];
  canvasSize: { width: number; height: number };
  zoom: number;
}

/** Tab metadata (project reference) */
export interface ProjectTab {
  id: string;
  name: string;
  isDirty: boolean;
  isDefaultProject: boolean; // Flag to mark the default project
}

interface ProjectState {
  /** List of open project tabs */
  tabs: ProjectTab[];
  
  /** Currently active tab ID */
  activeTabId: string | null;
  
  /** Cached project data for each tab */
  projectData: Record<string, ProjectData>;
  
  /** Whether the welcome/new project modal should be shown */
  showWelcome: boolean;

  // ── Actions ──────────────────────────────────────────────────

  /** Create a new project tab */
  createProject: (name: string) => string;
  
  /** Switch to a different tab */
  setActiveTab: (tabId: string) => void;
  
  /** Close a tab */
  closeTab: (tabId: string) => void;
  
  /** Rename a project */
  renameProject: (tabId: string, name: string) => void;
  
  /** Mark a project as dirty (unsaved changes) */
  markDirty: (tabId: string) => void;
  
  /** Update project data (for saving) */
  updateProjectData: (tabId: string, data: Partial<ProjectData>) => void;
  
  /** Get current project data */
  getCurrentProjectData: () => ProjectData | null;
  
  /** Import a project from file data */
  importProject: (data: ProjectData) => string;
  
  /** Export project data for saving to file */
  exportProject: (tabId: string) => ProjectData | null;
  
  /** Set welcome modal visibility */
  setShowWelcome: (show: boolean) => void;
  
  /** Mark project as saved (not dirty) */
  markSaved: (tabId: string) => void;
  
  /** Load default project data asynchronously */
  loadDefaultProject: () => Promise<void>;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,
      projectData: {},
      showWelcome: true,

      createProject: (name) => {
        const id = uuidv4();
        const newProject = createEmptyProject(name, id);

        const newTab: ProjectTab = {
          id,
          name,
          isDirty: false,
          isDefaultProject: false,
        };

        set((state) => ({
          tabs: [...state.tabs, newTab],
          activeTabId: id,
          projectData: { ...state.projectData, [id]: newProject },
          showWelcome: false,
        }));

        return id;
      },

      setActiveTab: (tabId) => {
        set({ activeTabId: tabId });
      },

      closeTab: (tabId) => {
        set((state) => {
          // Cannot close default project
          if (isDefaultProject(tabId)) {
            console.warn("Cannot close the default project");
            return state;
          }
          
          const newTabs = state.tabs.filter((t) => t.id !== tabId);
          const newProjectData = { ...state.projectData };
          delete newProjectData[tabId];

          // If closing active tab, switch to default or another tab
          let newActiveId = state.activeTabId;
          if (state.activeTabId === tabId) {
            // Prefer default project, or any other available tab
            const defaultTab = newTabs.find(t => t.isDefaultProject);
            newActiveId = defaultTab ? defaultTab.id : (newTabs.length > 0 ? newTabs[0].id : null);
          }

          return {
            tabs: newTabs,
            activeTabId: newActiveId,
            projectData: newProjectData,
            showWelcome: newTabs.length === 0,
          };
        });
      },

      renameProject: (tabId, name) => {
        set((state) => ({
          tabs: state.tabs.map((t) =>
            t.id === tabId ? { ...t, name } : t
          ),
          projectData: {
            ...state.projectData,
            [tabId]: state.projectData[tabId]
              ? { ...state.projectData[tabId], name, updatedAt: new Date().toISOString() }
              : state.projectData[tabId],
          },
        }));
      },

      markDirty: (tabId) => {
        set((state) => ({
          tabs: state.tabs.map((t) =>
            t.id === tabId ? { ...t, isDirty: true } : t
          ),
        }));
      },

      markSaved: (tabId) => {
        set((state) => ({
          tabs: state.tabs.map((t) =>
            t.id === tabId ? { ...t, isDirty: false } : t
          ),
          projectData: {
            ...state.projectData,
            [tabId]: state.projectData[tabId]
              ? { ...state.projectData[tabId], updatedAt: new Date().toISOString() }
              : state.projectData[tabId],
          },
        }));
      },

      updateProjectData: (tabId, data) => {
        set((state) => {
          const existing = state.projectData[tabId];
          if (!existing) return state;

          return {
            projectData: {
              ...state.projectData,
              [tabId]: {
                ...existing,
                ...data,
                updatedAt: new Date().toISOString(),
              },
            },
            tabs: state.tabs.map((t) =>
              t.id === tabId ? { ...t, isDirty: true } : t
            ),
          };
        });
      },

      getCurrentProjectData: () => {
        const { activeTabId, projectData } = get();
        if (!activeTabId) return null;
        return projectData[activeTabId] || null;
      },

      importProject: (data) => {
        // Generate new ID to avoid conflicts (unless it's being restored as default)
        const isRestoringDefault = data.id === DEFAULT_PROJECT_ID;
        const id = isRestoringDefault ? DEFAULT_PROJECT_ID : uuidv4();
        const now = new Date().toISOString();

        const importedProject: ProjectData = {
          ...data,
          id,
          updatedAt: now,
        };

        const newTab: ProjectTab = {
          id,
          name: data.name,
          isDirty: false,
          isDefaultProject: isRestoringDefault,
        };

        set((state) => ({
          tabs: [...state.tabs, newTab],
          activeTabId: id,
          projectData: { ...state.projectData, [id]: importedProject },
          showWelcome: false,
        }));

        return id;
      },

      exportProject: (tabId) => {
        const { projectData } = get();
        return projectData[tabId] || null;
      },

      setShowWelcome: (show) => {
        set({ showWelcome: show });
      },
      
      loadDefaultProject: async () => {
        const { projectData } = get();
        
        // Only load if not already loaded
        if (!projectData[DEFAULT_PROJECT_ID]) {
          try {
            const defaultProject = await createDefaultProject();
            set((state) => ({
              projectData: {
                ...state.projectData,
                [DEFAULT_PROJECT_ID]: defaultProject,
              },
            }));
          } catch (error) {
            console.error('Failed to load default project:', error);
          }
        }
      },
    }),
    {
      name: "simulator-projects",
      partialize: (state) => ({
        tabs: state.tabs,
        activeTabId: state.activeTabId,
        projectData: state.projectData,
        showWelcome: state.tabs.length === 0,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Ensure default project exists
          ensureDefaultProject(state);
        }
      },
    }
  )
);

/**
 * Ensure the default project exists in the store.
 * Called on rehydration and can be called manually.
 */
function ensureDefaultProject(state: ProjectState): void {
  const hasDefault = state.tabs.some(t => t.id === DEFAULT_PROJECT_ID);
  
  if (!hasDefault) {
    // Create the default project tab (data loaded on demand)
    const defaultTab: ProjectTab = {
      id: DEFAULT_PROJECT_ID,
      name: DEFAULT_PROJECT_NAME,
      isDirty: false,
      isDefaultProject: true,
    };
    
    // Add to beginning of tabs array
    state.tabs.unshift(defaultTab);
    
    // If no active tab, set default as active
    if (!state.activeTabId) {
      state.activeTabId = DEFAULT_PROJECT_ID;
      state.showWelcome = false;
    }
  }
  
  // Migration: mark existing default project if it exists but isn't flagged
  state.tabs = state.tabs.map(tab => ({
    ...tab,
    isDefaultProject: tab.id === DEFAULT_PROJECT_ID,
  }));
}

// ── File I/O utilities ──────────────────────────────────────────

export const CPUD_FILE_EXTENSION = ".cpud";
export const CPUD_MIME_TYPE = "application/json";

/**
 * Save project data to a .cpud file (triggers download)
 */
export function saveProjectToFile(project: ProjectData): void {
  const json = JSON.stringify(project, null, 2);
  const blob = new Blob([json], { type: CPUD_MIME_TYPE });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement("a");
  a.href = url;
  a.download = `${project.name}${CPUD_FILE_EXTENSION}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Read a .cpud file and parse its contents
 */
export async function loadProjectFromFile(file: File): Promise<ProjectData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const data = JSON.parse(text) as ProjectData;
        
        // Basic validation
        if (!data.id || !data.name || !Array.isArray(data.components)) {
          throw new Error("Invalid project file format");
        }
        
        resolve(data);
      } catch (err) {
        reject(new Error("Failed to parse project file"));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}
