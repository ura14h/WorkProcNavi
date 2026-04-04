import { writeFile } from "node:fs/promises";
import type { ExportEvidenceInput, ManualDocument, SessionData } from "../shared/types";
import { fromUnknown } from "./errors";
import { buildEvidenceFilePath } from "./path-utils";

function escapeYamlValue(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function buildForcedNote(phaseId: string, session: SessionData) {
  const record = [...session.phaseTransitionRecords].reverse().find((item) => item.phaseId === phaseId);
  if (!record || record.advanceMode !== "forced_with_pending" || record.pendingConfirmItemIds.length === 0) {
    return null;
  }

  return `> 注記: 未確認項目 ${record.pendingConfirmItemIds.length} 件を残したままこのフェーズを離脱しています。`;
}

export function createEvidenceMarkdown(manual: ManualDocument, session: SessionData) {
  const checkedIds = new Set(session.checkedItemIds);
  const lines = [
    "---",
    `実施開始: ${escapeYamlValue(session.startedAt)}`,
    `実施完了: ${escapeYamlValue(session.completedAt ?? session.updatedAt)}`,
    `手順書名: ${escapeYamlValue(manual.displayName)}`,
    "---",
    "",
    `# ${manual.title} 実施記録`,
    "",
  ];

  for (const phase of manual.phases) {
    lines.push(`## ${phase.title}`);
    const forcedNote = buildForcedNote(phase.phaseId, session);
    if (forcedNote) {
      lines.push("", forcedNote);
    }
    lines.push("");

    for (const step of phase.steps) {
      lines.push(`### ${step.title}`, "");
      for (const confirmItem of step.confirmItems) {
        lines.push(
          `- [${checkedIds.has(confirmItem.confirmItemId) ? "x" : " "}] ${confirmItem.text}`,
        );
      }
      lines.push("");
    }
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

export async function exportEvidence(input: ExportEvidenceInput) {
  const outputPath = buildEvidenceFilePath(input.manual.sourcePath);
  try {
    await writeFile(outputPath, createEvidenceMarkdown(input.manual, input.session), "utf8");
    return outputPath;
  } catch (error) {
    throw fromUnknown(
      "EVIDENCE_EXPORT_FAILED",
      "エビデンスファイルの出力に失敗しました。",
      error,
    );
  }
}
