/**
 * defaultProject.ts
 * 
 * Loads the default "Full Datapath" project from a .cpud file in the repository.
 * This project contains a pre-configured CPU with all necessary components
 * connected and ready to use as a reference implementation.
 */

import type { ProjectData } from "./projectStore";

/** ID for the default project - never changes */
export const DEFAULT_PROJECT_ID = "default-full-datapath";

/** Display name for the default project */
export const DEFAULT_PROJECT_NAME = "Full Datapath";

/**
 * Check if a project ID refers to the default project.
 * The default project has special protections (cannot be deleted).
 */
export function isDefaultProject(projectId: string | null): boolean {
  return projectId === DEFAULT_PROJECT_ID;
}

/**
 * Loads the default project from the .cpud file in the repository.
 * If loading fails, returns a minimal fallback project.
 */
export async function createDefaultProject(): Promise<ProjectData> {
  try {
    // Try to load the default project from the repository
    const response = await fetch('/default-project.cpud');
    if (!response.ok) {
      throw new Error(`Failed to load default project: ${response.status}`);
    }
    
    const projectData = await response.json() as ProjectData;
    
    // Validate that it has the expected ID and structure
    if (projectData.id !== DEFAULT_PROJECT_ID) {
      projectData.id = DEFAULT_PROJECT_ID;
    }
    if (projectData.name !== DEFAULT_PROJECT_NAME) {
      projectData.name = DEFAULT_PROJECT_NAME;
    }
    
    // Ensure required fields exist
    if (!projectData.components) projectData.components = [];
    if (!projectData.wires) projectData.wires = [];
    if (!projectData.canvasSize) projectData.canvasSize = { width: 4000, height: 3000 };
    if (!projectData.zoom) projectData.zoom = 0.8;
    
    return projectData;
  } catch (error) {
    console.warn('Failed to load default project from file, using fallback:', error);
    // Return a minimal fallback project
    return createFallbackProject();
  }
}

/**
 * Creates a minimal fallback default project when the .cpud file cannot be loaded.
 */
function createFallbackProject(): ProjectData {
  const now = new Date().toISOString();
  
  return {
    id: DEFAULT_PROJECT_ID,
    name: DEFAULT_PROJECT_NAME,
    createdAt: now,
    updatedAt: now,
    components: [
      // Just a CPU component as fallback
      {
        id: "cpu-1",
        type: "CpuComponent",
        label: "CPU",
        x: 400,
        y: 300,
        w: 176,
        h: 304,
        meta: {},
      },
    ],
    wires: [],
    canvasSize: { width: 4000, height: 3000 },
    zoom: 0.8,
  };
}

/**
 * Get a minimal empty project structure for custom user projects.
 * This creates a blank canvas with default settings.
 */
export function createEmptyProject(name: string, id?: string): ProjectData {
  const now = new Date().toISOString();
  
  return {
    id: id || `project-${Date.now()}`,
    name,
    createdAt: now,
    updatedAt: now,
    components: [],
    wires: [],
    canvasSize: { width: 3000, height: 2000 },
    zoom: 1,
  };
}
