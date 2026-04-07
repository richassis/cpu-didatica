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
    projectData,
    setActiveTab,
    createProject,
    importProject,
    exportProject,
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
    
    const project = exportProject(activeTabId);
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
          <div className="bg-gray-800 border border-gray-600 rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold text-white mb-4">Create New Project</h3>
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleConfirmNewProject();
                if (e.key === "Escape") handleCancelNewProject();
              }}
              placeholder="Project name..."
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white mb-4"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={handleCancelNewProject}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmNewProject}
                disabled={!newProjectName.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
        className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded text-white transition-colors"
      >
        {isDefault && <Star className="w-4 h-4 text-yellow-400" />}
        <span className="font-medium">{currentProjectName}</span>
        {isDirty && <span className="w-2 h-2 bg-orange-400 rounded-full" title="Unsaved changes" />}
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
          
          <div className="absolute top-full left-0 mt-1 w-64 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-20 overflow-hidden">
            {/* Project List */}
            <div className="max-h-64 overflow-y-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleSwitchProject(tab.id)}
                  className={`w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-gray-700 transition-colors ${
                    tab.id === activeTabId ? "bg-gray-700" : ""
                  }`}
                >
                  {tab.isDefaultProject && (
                    <Star className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                  )}
                  <span className="flex-1 text-white truncate">{tab.name}</span>
                  {tab.id === activeTabId && (
                    <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                  )}
                  {tab.isDirty && (
                    <span className="w-2 h-2 bg-orange-400 rounded-full flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>

            {/* Divider */}
            <div className="border-t border-gray-600" />

            {/* Actions */}
            <div className="p-1">
              <button
                onClick={handleCreateNew}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-white hover:bg-gray-700 rounded transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>New Project...</span>
              </button>

              <button
                onClick={handleImport}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-white hover:bg-gray-700 rounded transition-colors"
              >
                <Upload className="w-4 h-4" />
                <span>Import Project...</span>
              </button>

              <button
                onClick={handleExport}
                disabled={!activeTabId}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-white hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
                <span>Export Current</span>
              </button>

              {!isDefault && (
                <button
                  onClick={handleDelete}
                  disabled={!activeTabId || isDefault}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-red-400 hover:bg-red-900/20 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
