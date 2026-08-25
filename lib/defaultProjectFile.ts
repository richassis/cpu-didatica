/**
 * defaultProjectFile.ts
 *
 * Writing the reference datapath back to `public/default-project.cpud`.
 *
 * `app/page.tsx` does this on a 500 ms debounce while authoring, but that path
 * declines to write in one case — when the runtime has no wires while the
 * project still does, which it treats as a failed restore rather than a real
 * deletion. That guard is right, but it means a session can end with edits that
 * were never written. Since the layout is no longer mirrored into localStorage,
 * the file is the only copy, so edit mode also offers an explicit save that
 * goes through this.
 */

import { DEFAULT_PROJECT_ID } from "@/lib/defaultProject";
import { EDITOR_ENABLED } from "@/lib/editorFlag";
import { useProjectStore } from "@/lib/projectStore";

/**
 * Write the current default project to disk.
 *
 * Returns nothing on success and throws with a readable message otherwise, so
 * the caller can show the failure instead of leaving a save button that looks
 * like it worked.
 */
export async function saveDefaultProjectFile(): Promise<void> {
  if (!EDITOR_ENABLED) {
    throw new Error("O editor não está disponível nesta build.");
  }

  const project = useProjectStore.getState().projectData[DEFAULT_PROJECT_ID];
  if (!project) {
    throw new Error("O datapath padrão ainda não foi carregado.");
  }

  const response = await fetch("/api/default-project", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...project, updatedAt: new Date().toISOString() }),
  });

  if (!response.ok) {
    throw new Error(`Falha ao gravar o arquivo (HTTP ${response.status}).`);
  }
}
