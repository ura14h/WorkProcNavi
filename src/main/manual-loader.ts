import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import JSZip from "jszip";
import { createError, fromUnknown } from "./errors";
import { parseManualDocument } from "./manual-parser";
import type { AppError, LoadManualResult, ManualDocument, SessionData } from "../shared/types";
import { readSession, assertSourceExists } from "./session-store";
import type { RuntimeRegistry } from "./runtime-registry";

type LoadedSource = {
  runtimeManualId: string;
  sourceType: ManualDocument["sourceType"];
  sourcePath: string;
  sourceRootPath: string;
  markdown: string;
  tempDirPath?: string;
};

function isAppError(error: unknown): error is AppError {
  return !!error && typeof error === "object" && "code" in error && "message" in error;
}

async function extractZipPackage(sourcePath: string, runtimeManualId: string) {
  try {
    const buffer = await readFile(sourcePath);
    const zip = await JSZip.loadAsync(buffer);
    const tempRoot = path.join(os.tmpdir(), "work-proc-navi");
    await mkdir(tempRoot, { recursive: true });
    const tempDirPath = await mkdtemp(path.join(tempRoot, `${runtimeManualId}-`));
    const markdownEntries: string[] = [];
    const tempDirResolved = path.resolve(tempDirPath);

    for (const [entryName, entry] of Object.entries(zip.files)) {
      const normalized = entryName.replace(/\\/g, "/");
      if (normalized.includes("../")) {
        throw createError("ZIP_INVALID_STRUCTURE", "ZIP 内に不正なパスが含まれています。");
      }

      const outputPath = path.resolve(tempDirPath, normalized);
      if (
        outputPath !== tempDirResolved &&
        !outputPath.startsWith(`${tempDirResolved}${path.sep}`)
      ) {
        throw createError("ZIP_INVALID_STRUCTURE", "ZIP 内に不正なパスが含まれています。");
      }

      if (entry.dir) {
        continue;
      }

      const content = await entry.async("nodebuffer");
      await mkdir(path.dirname(outputPath), { recursive: true });
      await writeFile(outputPath, content);

      if (normalized.toLowerCase().endsWith(".md")) {
        markdownEntries.push(outputPath);
      }
    }

    if (markdownEntries.length === 0) {
      throw createError("ZIP_MARKDOWN_NOT_FOUND", "ZIP 内に Markdown ファイルが見つかりません。");
    }

    if (markdownEntries.length > 1) {
      throw createError(
        "ZIP_MARKDOWN_MULTIPLE",
        "ZIP 内の Markdown ファイルは 1 つだけにしてください。",
      );
    }

    const markdownPath = markdownEntries[0];
    return {
      markdown: await readFile(markdownPath, "utf8"),
      sourceRootPath: path.dirname(markdownPath),
      tempDirPath,
    };
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }
    throw fromUnknown("INPUT_READ_FAILED", "ZIP ファイルの読込に失敗しました。", error);
  }
}

async function loadSource(sourcePath: string): Promise<LoadedSource> {
  const extension = path.extname(sourcePath).toLowerCase();
  const runtimeManualId = randomUUID();

  if (extension === ".md") {
    try {
      return {
        runtimeManualId,
        sourceType: "markdown",
        sourcePath,
        sourceRootPath: path.dirname(sourcePath),
        markdown: await readFile(sourcePath, "utf8"),
      };
    } catch (error) {
      throw fromUnknown("INPUT_READ_FAILED", "Markdown ファイルの読込に失敗しました。", error);
    }
  }

  if (extension === ".zip") {
    const extracted = await extractZipPackage(sourcePath, runtimeManualId);
    return {
      runtimeManualId,
      sourceType: "zip",
      sourcePath,
      sourceRootPath: extracted.sourceRootPath,
      markdown: extracted.markdown,
      tempDirPath: extracted.tempDirPath,
    };
  }

  throw createError(
    "INPUT_UNSUPPORTED_EXTENSION",
    "対応しているのは .md / .zip / .session のみです。",
  );
}

function validateSessionAgainstManual(manual: ManualDocument, session: SessionData) {
  const phaseIds = new Set(manual.phases.map((phase) => phase.phaseId));
  const stepIds = new Set(
    manual.phases.flatMap((phase) => phase.steps.map((step) => step.stepId)),
  );
  const confirmItemIds = new Set(
    manual.phases.flatMap((phase) =>
      phase.steps.flatMap((step) => step.confirmItems.map((item) => item.confirmItemId)),
    ),
  );

  if (!phaseIds.has(session.currentPhaseId) || !stepIds.has(session.currentStepId)) {
    throw createError(
      "SESSION_STATE_MISMATCH",
      "セッションの現在位置が手順書の構造と一致しません。",
    );
  }

  if (session.checkedItemIds.some((itemId) => !confirmItemIds.has(itemId))) {
    throw createError(
      "SESSION_STATE_MISMATCH",
      "セッションの確認項目状態が手順書の構造と一致しません。",
    );
  }

  if (
    session.phaseTransitionRecords.some(
      (record) =>
        !phaseIds.has(record.phaseId) ||
        record.pendingConfirmItemIds.some((itemId) => !confirmItemIds.has(itemId)),
    )
  ) {
    throw createError(
      "SESSION_STATE_MISMATCH",
      "セッションのフェーズ遷移履歴が手順書の構造と一致しません。",
    );
  }
}

async function loadFromSession(
  sessionPath: string,
  runtimeRegistry: RuntimeRegistry,
): Promise<LoadManualResult> {
  const session = await readSession(sessionPath);
  await assertSourceExists(session.sourcePath);
  const loadedSource = await loadSource(session.sourcePath);
  const manual = parseManualDocument({
    markdown: loadedSource.markdown,
    sourcePath: loadedSource.sourcePath,
    sourceRootPath: loadedSource.sourceRootPath,
    sourceType: loadedSource.sourceType,
    runtimeManualId: loadedSource.runtimeManualId,
  });
  validateSessionAgainstManual(manual, session);
  runtimeRegistry.register(manual.runtimeManualId, {
    sourceRootPath: manual.sourceRootPath,
    tempDirPath: loadedSource.tempDirPath,
  });
  return { ok: true, manual, session };
}

export async function loadDroppedFile(
  filePath: string,
  runtimeRegistry: RuntimeRegistry,
): Promise<LoadManualResult> {
  try {
    const extension = path.extname(filePath).toLowerCase();
    if (extension === ".session") {
      return await loadFromSession(filePath, runtimeRegistry);
    }

    const loadedSource = await loadSource(filePath);
    const manual = parseManualDocument({
      markdown: loadedSource.markdown,
      sourcePath: loadedSource.sourcePath,
      sourceRootPath: loadedSource.sourceRootPath,
      sourceType: loadedSource.sourceType,
      runtimeManualId: loadedSource.runtimeManualId,
    });

    runtimeRegistry.register(manual.runtimeManualId, {
      sourceRootPath: manual.sourceRootPath,
      tempDirPath: loadedSource.tempDirPath,
    });

    return { ok: true, manual, session: null };
  } catch (error) {
    if (isAppError(error)) {
      return { ok: false, error };
    }

    return {
      ok: false,
      error: fromUnknown("INPUT_READ_FAILED", "入力ファイルの処理に失敗しました。", error),
    };
  }
}
