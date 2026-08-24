"use client";

import { useState, useRef } from "react";
import { useProjectStore } from "@/lib/projectStore";
import { isDefaultProject } from "@/lib/defaultProject";
import { saveProjectToFile, loadProjectFromFile } from "@/lib/projectStore";
import { 
  Star, 
  ChevronDown, 
  Plus, 
  Upload, 
  Download, 
  Save,
  Trash2,
  Check,
} from "lucide-react";

/**
 * ProjectSwitcher - Dropdown menu for project selection and management
 * 
 * Replaces the multi-tab interface with a simpler dropdown that allows:
 * - Switching between projects
 * - Creating new projects
 * - Importing/exporting projects
 * - Deleting custom projects (default project is protected)
 */
export default function ProjectSwitcher() {
  const {
    tabs,
    activeTabId,
    setActiveTab,
    createProject,
    importProject,
    getCurrentProjectDataEnhanced,
    closeTab,
    markSaved,
  } = useProjectStore();

  const [isOpen, setIsOpen] = useState(false);
  const [showNewProjectInput, setShowNewProjectInput] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentProject = tabs.find(t => t.id === activeTabId);
  const currentProjectName = currentProject?.name || "No Project";
  const isDirty = currentProject?.isDirty || false;
  const isDefault = currentProject?.isDefaultProject || false;

  // Handle project switch
  const handleSwitchProject = (projectId: string) => {
    if (projectId !== activeTabId) {
      setActiveTab(projectId);
    }
    setIsOpen(false);
  };

  // Handle new project creation
  const handleCreateNew = () => {
    setShowNewProjectInput(true);
    setIsOpen(false);
  };

  const handleConfirmNewProject = () => {
    if (newProjectName.trim()) {
      createProject(newProjectName.trim());
      setNewProjectName("");
      setShowNewProjectInput(false);
    }
  };

  const handleCancelNewProject = () => {
    setNewProjectName("");
    setShowNewProjectInput(false);
  };

  // Handle file import
  const handleImport = () => {
    fileInputRef.current?.click();
    setIsOpen(false);
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await loadProjectFromFile(file);
      importProject(data);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      alert(`Failed to import project: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  // Handle export
  const handleExport = () => {
    if (!activeTabId) return;
    
    const project = getCurrentProjectDataEnhanced();
    if (project) {
      saveProjectToFile(project);
      markSaved(activeTabId);
    }
    setIsOpen(false);
  };

  // Handle delete
  const handleDelete = () => {
    if (!activeTabId || isDefaultProject(activeTabId)) {
      alert("Cannot delete the default project");
      return;
    }

    const confirmed = confirm(`Delete project "${currentProjectName}"? This cannot be undone.`);
    if (confirmed) {
      closeTab(activeTabId);
    }
    setIsOpen(false);
  };

  return (
    <div className="relative">
      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".cpud"
        className="hidden"
        onChange={handleFileSelected}
      />

      {/* New Project Input Dialog */}
      {showNewProjectInput && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="w-[420px] rounded-2xl border border-line bg-surface p-6">
            <h3 className="t-panel text-fg mb-4">Create new project</h3>
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleConfirmNewProject();
                if (e.key === "Escape") handleCancelNewProject();
              }}
              placeholder="Project name..."
              className="mb-4 h-9 w-full rounded-lg border border-line bg-sunken px-3 text-fg focus:border-line-strong focus:outline-none"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={handleCancelNewProject}
                className="rounded-lg border border-line px-3 py-1.5 text-xs text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmNewProject}
                disabled={!newProjectName.trim()}
                className="rounded-lg border border-line-strong bg-raised px-3 py-1.5 text-xs text-fg transition-colors hover:border-st-active disabled:cursor-not-allowed disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Dropdown Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-8 items-center gap-2 rounded-lg border border-line px-3 text-xs text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
      >
        {isDefault && <Star className="h-3.5 w-3.5 text-st-warn" />}
        <span className="font-medium">{currentProjectName}</span>
        {isDirty && <span className="h-1.5 w-1.5 rounded-full bg-st-warn" title="Unsaved changes" />}
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop to close on outside click */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          
          <div className="absolute left-0 top-full z-20 mt-1 w-64 overflow-hidden rounded-xl border border-line bg-surface">
            {/* Project List */}
            <div className="max-h-64 overflow-y-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleSwitchProject(tab.id)}
                  className={`w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-raised transition-colors ${
                    tab.id === activeTabId ? "bg-raised" : ""
                  }`}
                >
                  {tab.isDefaultProject && (
                    <Star className="h-3.5 w-3.5 flex-shrink-0 text-st-warn" />
                  )}
                  <span className="flex-1 text-fg truncate">{tab.name}</span>
                  {tab.id === activeTabId && (
                    <Check className="h-3.5 w-3.5 flex-shrink-0 text-st-active" />
                  )}
                  {tab.isDirty && (
                    <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-st-warn" />
                  )}
                </button>
              ))}
            </div>

            {/* Divider */}
            <div className="border-t border-line" />

            {/* Actions */}
            <div className="p-1">
              <button
                onClick={handleExport}
                disabled={!activeTabId}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-fg-muted transition-colors hover:bg-raised hover:text-fg disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>Save Project</span>
              </button>

              <button
                onClick={handleCreateNew}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-fg-muted transition-colors hover:bg-raised hover:text-fg"
              >
                <Plus className="w-4 h-4" />
                <span>New Project...</span>
              </button>

              <button
                onClick={handleImport}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-fg-muted transition-colors hover:bg-raised hover:text-fg"
              >
                <Upload className="w-4 h-4" />
                <span>Import Project...</span>
              </button>

              <button
                onClick={handleExport}
                disabled={!activeTabId}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-fg-muted transition-colors hover:bg-raised hover:text-fg disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>Export Current</span>
              </button>

              {!isDefault && (
                <button
                  onClick={handleDelete}
                  disabled={!activeTabId || isDefault}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-st-error transition-colors hover:bg-raised disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Project</span>
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
