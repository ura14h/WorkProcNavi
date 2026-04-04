import { access, readFile, rename, rm, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import type { SessionData } from "../shared/types";
import { APP_VERSION } from "../shared/constants";
import { createError, fromUnknown } from "./errors";
import { buildSessionFilePath } from "./path-utils";

function ensureString(value: unknown, fieldName: string) {
  if (typeof value !== "string") {
    throw createError("SESSION_INVALID_JSON", `${fieldName} の形式が不正です。`);
  }
  return value;
}

function ensureNullableString(value: unknown, fieldName: string) {
  if (value !== null && typeof value !== "string") {
    throw createError("SESSION_INVALID_JSON", `${fieldName} の形式が不正です。`);
  }
  return value;
}

function ensureStringArray(value: unknown, fieldName: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw createError("SESSION_INVALID_JSON", `${fieldName} の形式が不正です。`);
  }
  return value;
}

export function buildInitialSession(params: {
  manualId: string;
  sourcePath: string;
  sourceType: SessionData["sourceType"];
  currentPhaseId: string;
  currentStepId: string;
}): SessionData {
  const timestamp = new Date().toISOString();
  const sessionFilePath = buildSessionFilePath(params.sourcePath);
  return {
    sessionId: `session-${Date.now()}`,
    appVersion: APP_VERSION,
    manualId: params.manualId,
    sourcePath: params.sourcePath,
    sourceType: params.sourceType,
    sessionFilePath,
    status: "in_progress",
    currentPhaseId: params.currentPhaseId,
    currentStepId: params.currentStepId,
    checkedItemIds: [],
    phaseTransitionRecords: [],
    startedAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
  };
}

export async function saveSession(session: SessionData) {
  const output = {
    ...session,
    appVersion: APP_VERSION,
    updatedAt: new Date().toISOString(),
  };

  const tempPath = `${session.sessionFilePath}.tmp`;
  try {
    await writeFile(tempPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
    await rename(tempPath, session.sessionFilePath);
    return output;
  } catch (error) {
    throw fromUnknown(
      "SESSION_SAVE_FAILED",
      "セッションファイルの保存に失敗しました。",
      error,
    );
  }
}

export async function deleteSession(sessionFilePath: string) {
  await rm(sessionFilePath, { force: true });
}

export async function readSession(sessionFilePath: string): Promise<SessionData> {
  try {
    const raw = await readFile(sessionFilePath, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const phaseTransitionRecords = Array.isArray(parsed.phaseTransitionRecords)
      ? parsed.phaseTransitionRecords.map((record) => {
          if (!record || typeof record !== "object") {
            throw createError("SESSION_INVALID_JSON", "phaseTransitionRecords の形式が不正です。");
          }
          return {
            phaseId: ensureString(record.phaseId, "phaseId"),
            leftAt: ensureString(record.leftAt, "leftAt"),
            advanceMode:
              record.advanceMode === "all_confirmed" || record.advanceMode === "forced_with_pending"
                ? record.advanceMode
                : (() => {
                    throw createError("SESSION_INVALID_JSON", "advanceMode の形式が不正です。");
                  })(),
            pendingConfirmItemIds: ensureStringArray(
              record.pendingConfirmItemIds,
              "pendingConfirmItemIds",
            ),
          };
        })
      : [];

    return {
      sessionId: ensureString(parsed.sessionId, "sessionId"),
      appVersion: ensureString(parsed.appVersion, "appVersion"),
      manualId: ensureString(parsed.manualId, "manualId"),
      sourcePath: ensureString(parsed.sourcePath, "sourcePath"),
      sourceType:
        parsed.sourceType === "markdown" || parsed.sourceType === "zip"
          ? parsed.sourceType
          : (() => {
              throw createError("SESSION_INVALID_JSON", "sourceType の形式が不正です。");
            })(),
      sessionFilePath: ensureString(parsed.sessionFilePath, "sessionFilePath"),
      status:
        parsed.status === "in_progress" || parsed.status === "completed"
          ? parsed.status
          : (() => {
              throw createError("SESSION_INVALID_JSON", "status の形式が不正です。");
            })(),
      currentPhaseId: ensureString(parsed.currentPhaseId, "currentPhaseId"),
      currentStepId: ensureString(parsed.currentStepId, "currentStepId"),
      checkedItemIds: ensureStringArray(parsed.checkedItemIds, "checkedItemIds"),
      phaseTransitionRecords,
      startedAt: ensureString(parsed.startedAt, "startedAt"),
      updatedAt: ensureString(parsed.updatedAt, "updatedAt"),
      completedAt: ensureNullableString(parsed.completedAt, "completedAt"),
    };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      throw error;
    }
    throw fromUnknown("SESSION_INVALID_JSON", "セッションファイルの読込に失敗しました。", error);
  }
}

export async function assertSourceExists(sourcePath: string) {
  try {
    await access(sourcePath, fsConstants.F_OK);
  } catch (error) {
    throw fromUnknown(
      "SESSION_SOURCE_NOT_FOUND",
      "セッションが参照する手順書ファイルが見つかりません。",
      error,
    );
  }
}
