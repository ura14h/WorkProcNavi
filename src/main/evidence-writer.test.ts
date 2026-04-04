import { describe, expect, it } from "vitest";
import { createEvidenceMarkdown } from "./evidence-writer";
import type { ManualDocument, SessionData } from "../shared/types";

const manual: ManualDocument = {
  manualId: "sample",
  runtimeManualId: "runtime-1",
  title: "サンプル手順",
  sourceType: "markdown",
  sourcePath: "/tmp/sample.md",
  sourceRootPath: "/tmp",
  displayName: "sample.md",
  overviewBlocks: [],
  phases: [
    {
      phaseId: "phase-001",
      index: 1,
      title: "事前確認",
      introBlocks: [],
      totals: {
        stepCount: 1,
        confirmItemCount: 2,
      },
      steps: [
        {
          stepId: "phase-001-step-001",
          index: 1,
          title: "電源を確認する",
          contentBlocks: [],
          confirmItems: [
            { confirmItemId: "phase-001-step-001-check-001", index: 1, text: "電源が切れている" },
            { confirmItemId: "phase-001-step-001-check-002", index: 2, text: "ケーブルに問題がない" },
          ],
        },
      ],
    },
  ],
  totals: {
    phaseCount: 1,
    stepCount: 1,
    confirmItemCount: 2,
  },
};

const session: SessionData = {
  sessionId: "session-1",
  appVersion: "0.1.0",
  manualId: "sample",
  sourcePath: "/tmp/sample.md",
  sourceType: "markdown",
  sessionFilePath: "/tmp/sample.session",
  status: "completed",
  currentPhaseId: "phase-001",
  currentStepId: "phase-001-step-001",
  checkedItemIds: ["phase-001-step-001-check-001"],
  phaseTransitionRecords: [
    {
      phaseId: "phase-001",
      leftAt: "2026-04-04T10:00:00+09:00",
      advanceMode: "forced_with_pending",
      pendingConfirmItemIds: ["phase-001-step-001-check-002"],
    },
  ],
  startedAt: "2026-04-04T09:00:00+09:00",
  updatedAt: "2026-04-04T10:00:00+09:00",
  completedAt: "2026-04-04T10:00:00+09:00",
};

describe("createEvidenceMarkdown", () => {
  it("renders YAML front matter, headings, and check results", () => {
    const output = createEvidenceMarkdown(manual, session);

    expect(output).toContain("---");
    expect(output).toContain("# サンプル手順 実施記録");
    expect(output).toContain("## 事前確認");
    expect(output).toContain("- [x] 電源が切れている");
    expect(output).toContain("- [ ] ケーブルに問題がない");
    expect(output).toContain("未確認項目 1 件");
  });
});
