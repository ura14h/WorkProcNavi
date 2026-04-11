import { stat as defaultStat } from "node:fs/promises";
import path from "node:path";
import type { AppError } from "../shared/types";
import { createError } from "./errors";

type StatLike = {
  isDirectory: () => boolean;
};

type StatFn = (targetPath: string) => Promise<StatLike>;

export type ResolvedManualLinkTarget =
  | { kind: "externalUrl"; url: string }
  | { kind: "fileDirectory"; path: string }
  | { kind: "fileItem"; path: string };

export type ResolveManualLinkTargetResult =
  | { ok: true; target: ResolvedManualLinkTarget }
  | { ok: false; error: AppError };

type ResolveOptions = {
  platform?: NodeJS.Platform;
  stat?: StatFn;
};

function invalidUrlError() {
  return createError("LINK_INVALID_URL", "リンクの形式が正しくありません。");
}

function unsupportedProtocolError() {
  return createError("LINK_UNSUPPORTED_PROTOCOL", "対応していない種類のリンクです。");
}

function targetNotFoundError() {
  return createError("LINK_TARGET_NOT_FOUND", "リンク先のファイルまたはフォルダが見つかりません。");
}

function decodePathname(pathname: string) {
  try {
    return decodeURIComponent(pathname);
  } catch {
    throw invalidUrlError();
  }
}

function isAppError(error: unknown): error is AppError {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as Partial<AppError>;
  return (
    typeof candidate.code === "string" &&
    typeof candidate.message === "string" &&
    typeof candidate.recoverable === "boolean"
  );
}

export function fileUrlToOsPath(href: string, platform: NodeJS.Platform = process.platform) {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    throw invalidUrlError();
  }

  if (url.protocol !== "file:") {
    throw unsupportedProtocolError();
  }

  const hostname = url.hostname;
  const pathname = decodePathname(url.pathname);

  if (platform === "win32") {
    if (hostname && hostname !== "localhost") {
      return path.win32.normalize(`\\\\${hostname}${pathname.replace(/\//g, "\\")}`);
    }

    const withoutDrivePrefixSlash = pathname.replace(/^\/([a-zA-Z]:)/, "$1");
    return path.win32.normalize(withoutDrivePrefixSlash.replace(/\//g, "\\"));
  }

  if (hostname && hostname !== "localhost") {
    throw unsupportedProtocolError();
  }

  return path.posix.normalize(pathname);
}

export async function resolveManualLinkTarget(
  href: string,
  options: ResolveOptions = {},
): Promise<ResolveManualLinkTargetResult> {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return { ok: false, error: invalidUrlError() };
  }

  if (url.protocol === "http:" || url.protocol === "https:") {
    return { ok: true, target: { kind: "externalUrl", url: url.toString() } };
  }

  if (url.protocol !== "file:") {
    return { ok: false, error: unsupportedProtocolError() };
  }

  let targetPath: string;
  try {
    targetPath = fileUrlToOsPath(url.toString(), options.platform);
  } catch (error) {
    if (isAppError(error)) {
      return { ok: false, error };
    }
    return { ok: false, error: invalidUrlError() };
  }

  const stat = options.stat ?? defaultStat;
  let fileStat: StatLike;
  try {
    fileStat = await stat(targetPath);
  } catch {
    return {
      ok: false,
      error: targetNotFoundError(),
    };
  }

  return {
    ok: true,
    target: {
      kind: fileStat.isDirectory() ? "fileDirectory" : "fileItem",
      path: targetPath,
    },
  };
}
