import { APP_VERSION } from "./constants";
import type { ManualDocument, PhaseAdvanceMode, PhaseTransitionRecord, SessionData } from "./types";

function buildSessionFilePath(sourcePath: string) {
  return sourcePath.replace(/\.[^.]+$/, ".session");
}

export function createInitialSession(manual: ManualDocument): SessionData {
  const firstPhase = manual.phases[0];
  const firstStep = firstPhase?.steps[0];
  const timestamp = new Date().toISOString();

  return {
    sessionId: `session-${Date.now()}`,
    appVersion: APP_VERSION,
    manualId: manual.manualId,
    sourcePath: manual.sourcePath,
    sourceType: manual.sourceType,
    sessionFilePath: buildSessionFilePath(manual.sourcePath),
    status: "in_progress",
    currentPhaseId: firstPhase.phaseId,
    currentStepId: firstStep.stepId,
    checkedItemIds: [],
    phaseTransitionRecords: [],
    startedAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
  };
}

export function upsertPhaseTransitionRecord(
  records: PhaseTransitionRecord[],
  input: {
    phaseId: string;
    advanceMode: PhaseAdvanceMode;
    pendingConfirmItemIds: string[];
    leftAt?: string;
  },
) {
  const nextRecord: PhaseTransitionRecord = {
    phaseId: input.phaseId,
    leftAt: input.leftAt ?? new Date().toISOString(),
    advanceMode: input.advanceMode,
    pendingConfirmItemIds: input.pendingConfirmItemIds,
  };

  return [...records.filter((record) => record.phaseId !== input.phaseId), nextRecord];
}
