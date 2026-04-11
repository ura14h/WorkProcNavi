export type SourceType = "markdown" | "zip";

export type RenderBlock =
  | { type: "paragraph"; html: string }
  | { type: "list"; html: string }
  | { type: "blockquote"; html: string }
  | { type: "code"; language: string | null; code: string }
  | { type: "image"; alt: string; assetUrl: string; title?: string }
  | { type: "table"; html: string }
  | { type: "heading4plus"; level: number; text: string }
  | { type: "thematicBreak" };

export type ConfirmItem = {
  confirmItemId: string;
  index: number;
  text: string;
  html: string;
};

export type Step = {
  stepId: string;
  index: number;
  title: string;
  contentBlocks: RenderBlock[];
  confirmItems: ConfirmItem[];
};

export type PhaseTotals = {
  stepCount: number;
  confirmItemCount: number;
};

export type Phase = {
  phaseId: string;
  index: number;
  title: string;
  introBlocks: RenderBlock[];
  steps: Step[];
  totals: PhaseTotals;
};

export type ManualTotals = {
  phaseCount: number;
  stepCount: number;
  confirmItemCount: number;
};

export type ManualDocument = {
  manualId: string;
  runtimeManualId: string;
  title: string;
  sourceType: SourceType;
  sourcePath: string;
  sourceRootPath: string;
  displayName: string;
  overviewBlocks: RenderBlock[];
  phases: Phase[];
  totals: ManualTotals;
};

export type SessionStatus = "in_progress" | "completed";
export type PhaseAdvanceMode = "all_confirmed" | "forced_with_pending";

export type PhaseTransitionRecord = {
  phaseId: string;
  leftAt: string;
  advanceMode: PhaseAdvanceMode;
  pendingConfirmItemIds: string[];
};

export type SessionData = {
  sessionId: string;
  appVersion: string;
  manualId: string;
  sourcePath: string;
  sourceType: SourceType;
  sessionFilePath: string;
  status: SessionStatus;
  currentPhaseId: string;
  currentStepId: string;
  checkedItemIds: string[];
  phaseTransitionRecords: PhaseTransitionRecord[];
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type AppError = {
  code: string;
  message: string;
  recoverable: boolean;
  detail?: string;
};

export type LoadManualResult =
  | { ok: true; manual: ManualDocument; session: SessionData | null }
  | { ok: false; error: AppError };

export type SaveSessionInput = {
  manual: ManualDocument;
  session: SessionData;
};

export type SaveSessionResult =
  | { ok: true; savedAt: string }
  | { ok: false; error: AppError };

export type ExportEvidenceInput = {
  manual: ManualDocument;
  session: SessionData;
};

export type ExportEvidenceResult =
  | { ok: true; outputPath: string }
  | { ok: false; error: AppError };

export type ManualLinkKind = "externalUrl" | "fileDirectory" | "fileItem";

export type OpenManualLinkInput = {
  href: string;
};

export type OpenManualLinkResult =
  | { ok: true; kind: ManualLinkKind; openedPath?: string }
  | { ok: false; error: AppError };

export type WorkProcNaviApi = {
  loadDroppedFile: (filePath: string) => Promise<LoadManualResult>;
  saveSession: (input: SaveSessionInput) => Promise<SaveSessionResult>;
  exportEvidence: (input: ExportEvidenceInput) => Promise<ExportEvidenceResult>;
  abandonRuntime: (runtimeManualId: string) => Promise<void>;
  copyText: (text: string) => Promise<void>;
  openManualLink: (input: OpenManualLinkInput) => Promise<OpenManualLinkResult>;
  revealPath: (path: string) => Promise<void>;
  setCloseGuardEnabled: (enabled: boolean) => Promise<void>;
  getPathForFile: (file: File) => string | null;
};
