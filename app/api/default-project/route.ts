import { NextResponse } from "next/server";
import { readFile, writeFile } from "fs/promises";
import path from "path";
import { DEFAULT_PROJECT_ID } from "@/lib/defaultProject";
import { EDITOR_ENABLED } from "@/lib/editorFlag";
import type { ProjectData } from "@/lib/projectStore";

/**
 * Component types whose runtime data — memory cells, register values, the
 * register bank — must not be saved into the reference datapath. The file is
 * the layout (positions, sizes, bit widths, ticks, wires); what a program left
 * in memory is not part of it, and would rewrite the file on every run.
 */
const DATA_COMPONENT_TYPES = new Set([
  "Register",
  "PipelineRegister",
  "GprComponent",
  "MemoryComponent",
  "InstructionMemoryComponent",
]);

/** The project as it should be written: no data state on memories and registers. */
function withoutDataState(project: ProjectData): ProjectData {
  return {
    ...project,
    components: project.components.map((component) => {
      if (!DATA_COMPONENT_TYPES.has(component.type) || !("state" in component)) return component;
      const rest = { ...component };
      delete rest.state;
      return rest;
    }),
  };
}

/** Serialised form, minus the timestamp, for "did anything really change". */
function fingerprint(project: unknown): string {
  return JSON.stringify(project, (key, value) => (key === "updatedAt" ? undefined : value));
}

export async function POST(request: Request) {
  // This route writes into the working tree, so it only exists for the
  // developer running the editor locally. In a published build it is inert —
  // nothing in the app calls it, and an outside caller gets a 404.
  if (!EDITOR_ENABLED) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const payload = (await request.json()) as ProjectData;

    if (!payload || payload.id !== DEFAULT_PROJECT_ID) {
      return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
    }

    const filePath = path.join(process.cwd(), "public", "default-project.cpud");
    const project = withoutDataState(payload);

    // The timestamp alone must not rewrite the file: without this every
    // autosave dirties the working tree even when nothing was edited.
    try {
      const onDisk = JSON.parse(await readFile(filePath, "utf-8")) as unknown;
      if (fingerprint(onDisk) === fingerprint(project)) {
        return NextResponse.json({ ok: true, unchanged: true });
      }
    } catch {
      // No file yet, or unreadable: write it.
    }

    // Trailing newline: without it every autosave shows up in `git diff` as
    // "\ No newline at end of file" on top of the real change.
    const body = `${JSON.stringify(project, null, 2)}\n`;
    await writeFile(filePath, body, "utf-8");

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to write default-project.cpud:", error);
    return NextResponse.json({ error: "Failed to write file" }, { status: 500 });
  }
}
