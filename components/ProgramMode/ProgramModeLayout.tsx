"use client";

import AssemblyPanel from "@/components/ProgramMode/AssemblyPanel";
import DatapathViewer from "@/components/ProgramMode/DatapathViewer";
import ExecutionTimeline from "@/components/ProgramMode/ExecutionTimeline";
import { useExecutionStore } from "@/lib/executionStore";

/**
 * ProgramModeLayout — Full-screen layout for Program Mode.
 *
 * ┌──────────────┬──────────────────────────────────────────┐
 * │              │                                          │
 * │  Assembly    │   Datapath Canvas (read-only)            │
 * │  Panel       │                                          │
 * │  (300px)     │                                          │
 * │              │                                          │
 * ├──────────────┴──────────────────────────────────────────┤
 * │  ExecutionTimeline (only visible when isTimelineActive) │
 * └─────────────────────────────────────────────────────────┘
 */
export default function ProgramModeLayout() {
  const isTimelineActive = useExecutionStore((s) => s.isTimelineActive);

  return (
    <div className={`relative flex-1 min-h-0 ${isTimelineActive ? "pb-24" : ""}`}>
      <div className="flex h-full min-h-0">
        {/* Left: Assembly Editor (300px) */}
        <div className="w-[300px] shrink-0 min-h-0 overflow-hidden">
          <AssemblyPanel />
        </div>

        {/* Right: Datapath Canvas (read-only) */}
        <div className="flex-1 min-h-0 min-w-0">
          <DatapathViewer />
        </div>
      </div>

      {/* Bottom: Execution Timeline — only shown when timeline is active */}
      {isTimelineActive && <ExecutionTimeline />}
    </div>
  );
}
