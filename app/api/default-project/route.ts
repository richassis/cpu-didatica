import { NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";
import { DEFAULT_PROJECT_ID } from "@/lib/defaultProject";
import { EDITOR_ENABLED } from "@/lib/editorFlag";
import type { ProjectData } from "@/lib/projectStore";

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
    // Trailing newline: without it every autosave shows up in `git diff` as
    // "\ No newline at end of file" on top of the real change.
    const body = `${JSON.stringify(payload, null, 2)}\n`;
    await writeFile(filePath, body, "utf-8");

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to write default-project.cpud:", error);
    return NextResponse.json({ error: "Failed to write file" }, { status: 500 });
  }
}
