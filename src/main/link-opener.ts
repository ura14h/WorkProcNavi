import { BrowserWindow, dialog, shell } from "electron";
import type { OpenManualLinkInput, OpenManualLinkResult } from "../shared/types";
import { createError } from "./errors";
import { resolveManualLinkTarget } from "./link-resolver";

type OpenManualLinkDeps = {
  resolveManualLinkTarget?: typeof resolveManualLinkTarget;
  openExternal?: typeof shell.openExternal;
  openPath?: typeof shell.openPath;
  showItemInFolder?: typeof shell.showItemInFolder;
  confirmMissingFile?: (
    targetPath: string,
    parentDirectoryPath: string,
    ownerWindow: BrowserWindow | null,
  ) => Promise<boolean>;
};

async function confirmMissingFileOpen(
  targetPath: string,
  parentDirectoryPath: string,
  ownerWindow: BrowserWindow | null,
) {
  const response = await dialog.showMessageBox(ownerWindow ?? undefined, {
    type: "question",
    buttons: ["フォルダを開く", "キャンセル"],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
    title: "作業手順ナビ",
    message: "リンク先のファイルが見つかりません。",
    detail: [
      `ファイル: ${targetPath}`,
      `親フォルダ: ${parentDirectoryPath}`,
      "親フォルダだけを開きますか。",
    ].join("\n"),
  });

  return response.response === 0;
}

export async function openManualLink(
  input: OpenManualLinkInput,
  ownerWindow: BrowserWindow | null = null,
  deps: OpenManualLinkDeps = {},
): Promise<OpenManualLinkResult> {
  const resolveTarget = deps.resolveManualLinkTarget ?? resolveManualLinkTarget;
  const openExternal =
    deps.openExternal ??
    (async (url: string) => {
      await shell.openExternal(url);
    });
  const openPath =
    deps.openPath ??
    (async (targetPath: string) => {
      return shell.openPath(targetPath);
    });
  const showItemInFolder =
    deps.showItemInFolder ??
    ((targetPath: string) => {
      shell.showItemInFolder(targetPath);
    });
  const confirmMissingFile = deps.confirmMissingFile ?? confirmMissingFileOpen;

  const resolved = await resolveTarget(input.href);
  if (!resolved.ok) {
    return resolved;
  }

  try {
    const { target } = resolved;
    if (target.kind === "externalUrl") {
      await openExternal(target.url);
      return { ok: true, kind: target.kind };
    }

    if (target.kind === "fileDirectory") {
      const errorMessage = await openPath(target.path);
      if (errorMessage) {
        return {
          ok: false,
          error: createError("LINK_OPEN_FAILED", "リンク先フォルダを開けませんでした。"),
        };
      }
      return { ok: true, kind: target.kind, openedPath: target.path };
    }

    if (target.exists) {
      showItemInFolder(target.path);
      return { ok: true, kind: target.kind, openedPath: target.path };
    }

    const shouldOpenParent = await confirmMissingFile(
      target.path,
      target.parentDirectoryPath,
      ownerWindow,
    );
    if (!shouldOpenParent) {
      return {
        ok: false,
        error: createError("LINK_OPEN_CANCELLED", "リンクを開く操作を取り消しました。"),
      };
    }

    const errorMessage = await openPath(target.parentDirectoryPath);
    if (errorMessage) {
      return {
        ok: false,
        error: createError("LINK_OPEN_FAILED", "リンク先フォルダを開けませんでした。"),
      };
    }

    return { ok: true, kind: "fileDirectory", openedPath: target.parentDirectoryPath };
  } catch {
    return {
      ok: false,
      error: createError("LINK_OPEN_FAILED", "リンクを開けませんでした。"),
    };
  }
}
