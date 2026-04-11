import { shell } from "electron";
import type { OpenManualLinkInput, OpenManualLinkResult } from "../shared/types";
import { createError } from "./errors";
import { resolveManualLinkTarget } from "./link-resolver";

export async function openManualLink(
  input: OpenManualLinkInput,
): Promise<OpenManualLinkResult> {
  const resolved = await resolveManualLinkTarget(input.href);
  if (!resolved.ok) {
    return resolved;
  }

  try {
    const { target } = resolved;
    if (target.kind === "externalUrl") {
      await shell.openExternal(target.url);
      return { ok: true, kind: target.kind };
    }

    if (target.kind === "fileDirectory") {
      const errorMessage = await shell.openPath(target.path);
      if (errorMessage) {
        return {
          ok: false,
          error: createError("LINK_OPEN_FAILED", "リンク先フォルダを開けませんでした。"),
        };
      }
      return { ok: true, kind: target.kind, openedPath: target.path };
    }

    shell.showItemInFolder(target.path);
    return { ok: true, kind: target.kind, openedPath: target.path };
  } catch {
    return {
      ok: false,
      error: createError("LINK_OPEN_FAILED", "リンクを開けませんでした。"),
    };
  }
}
