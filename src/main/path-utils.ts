import path from "node:path";
import { EVIDENCE_EXTENSION, SESSION_EXTENSION } from "../shared/constants";

export function manualIdFromSourcePath(sourcePath: string) {
  return path.parse(sourcePath).name;
}

export function buildSessionFilePath(sourcePath: string) {
  const parsed = path.parse(sourcePath);
  return path.join(parsed.dir, `${parsed.name}${SESSION_EXTENSION}`);
}

export function buildEvidenceFilePath(sourcePath: string) {
  const parsed = path.parse(sourcePath);
  return path.join(parsed.dir, `${parsed.name}${EVIDENCE_EXTENSION}`);
}
