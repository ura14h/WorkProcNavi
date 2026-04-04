import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import type { RuntimeRegistry } from "./runtime-registry";
import { ASSET_PROTOCOL } from "../shared/constants";

const SVG_PLACEHOLDER = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="180" viewBox="0 0 640 180">
  <rect width="640" height="180" rx="18" fill="#fff4e8"/>
  <rect x="12" y="12" width="616" height="156" rx="14" fill="#fffdf8" stroke="#f0c7a1" stroke-width="2"/>
  <text x="32" y="72" fill="#8f4e20" font-size="26" font-family="sans-serif">画像を表示できません</text>
  <text x="32" y="108" fill="#b36a39" font-size="16" font-family="sans-serif">指定されたアセットが見つからないか、参照が許可されていません。</text>
</svg>`;

function contentTypeFor(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  switch (extension) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}

function placeholderResponse() {
  return new Response(SVG_PLACEHOLDER, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export function registerAssetProtocol(
  protocol: Electron.Protocol,
  runtimeRegistry: RuntimeRegistry,
) {
  protocol.handle(ASSET_PROTOCOL, async (request) => {
    try {
      const requestUrl = new URL(request.url);
      const [runtimeManualId, ...assetParts] = requestUrl.pathname
        .split("/")
        .filter(Boolean);
      if (requestUrl.hostname !== "manual" || !runtimeManualId || assetParts.length === 0) {
        return placeholderResponse();
      }

      const entry = runtimeRegistry.get(runtimeManualId);
      if (!entry) {
        return placeholderResponse();
      }

      const relativePath = decodeURIComponent(assetParts.join("/"));
      const resolvedPath = path.resolve(entry.sourceRootPath, relativePath);
      const allowedRoot = path.resolve(entry.sourceRootPath);
      if (
        resolvedPath !== allowedRoot &&
        !resolvedPath.startsWith(`${allowedRoot}${path.sep}`)
      ) {
        return placeholderResponse();
      }

      if (!existsSync(resolvedPath)) {
        return placeholderResponse();
      }

      const fileStat = await stat(resolvedPath);
      if (!fileStat.isFile()) {
        return placeholderResponse();
      }

      const stream = Readable.toWeb(createReadStream(resolvedPath)) as ReadableStream<Uint8Array>;
      return new Response(stream, {
        headers: {
          "content-type": contentTypeFor(resolvedPath),
          "cache-control": "no-store",
        },
      });
    } catch {
      return placeholderResponse();
    }
  });
}
