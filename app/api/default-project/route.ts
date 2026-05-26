import { NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";
import { DEFAULT_PROJECT_ID } from "@/lib/defaultProject";
import type { ProjectData } from "@/lib/projectStore";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as ProjectData;

    if (!payload || payload.id !== DEFAULT_PROJECT_ID) {
      return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
    }

    const filePath = path.join(process.cwd(), "public", "default-project.cpud");
    const body = JSON.stringify(payload, null, 2);
    await writeFile(filePath, body, "utf-8");

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to write default-project.cpud:", error);
    return NextResponse.json({ error: "Failed to write file" }, { status: 500 });
  }
}
