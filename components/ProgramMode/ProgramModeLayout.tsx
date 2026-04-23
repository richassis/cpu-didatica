"use client";

import ProgramEditor from "@/components/ProgramMode/ProgramEditor";
import DatapathViewer from "@/components/ProgramMode/DatapathViewer";
import ExecutionTimeline from "@/components/ProgramMode/ExecutionTimeline";

export default function ProgramModeLayout() {
  return (
    <div className="relative flex-1 min-h-0 pb-24">
      <div className="flex h-full min-h-0">
        <div className="w-[280px] shrink-0 min-h-0">
          <ProgramEditor />
        </div>
        <DatapathViewer />
      </div>

      <ExecutionTimeline />
    </div>
  );
}
