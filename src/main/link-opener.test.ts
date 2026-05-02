import { describe, expect, it, vi } from "vitest";
import { openManualLink } from "./link-opener";

describe("openManualLink", () => {
  it("reveals an existing file in its parent folder", async () => {
    const showItemInFolder = vi.fn();

    const result = await openManualLink(
      { href: "file:///tmp/existing.txt" },
      null,
      {
        resolveManualLinkTarget: async () => ({
          ok: true,
          target: {
            kind: "fileItem",
            path: "/tmp/existing.txt",
            exists: true,
            parentDirectoryPath: "/tmp",
          },
        }),
        showItemInFolder,
      },
    );

    expect(result).toEqual({
      ok: true,
      kind: "fileItem",
      openedPath: "/tmp/existing.txt",
    });
    expect(showItemInFolder).toHaveBeenCalledWith("/tmp/existing.txt");
  });

  it("asks before opening the parent folder when the target file is missing", async () => {
    const openPath = vi.fn(async () => "");
    const confirmMissingFile = vi.fn(async () => true);

    const result = await openManualLink(
      { href: "file:///tmp/missing.txt" },
      null,
      {
        resolveManualLinkTarget: async () => ({
          ok: true,
          target: {
            kind: "fileItem",
            path: "/tmp/missing.txt",
            exists: false,
            parentDirectoryPath: "/tmp",
          },
        }),
        openPath,
        confirmMissingFile,
      },
    );

    expect(confirmMissingFile).toHaveBeenCalledWith("/tmp/missing.txt", "/tmp", null);
    expect(openPath).toHaveBeenCalledWith("/tmp");
    expect(result).toEqual({
      ok: true,
      kind: "fileDirectory",
      openedPath: "/tmp",
    });
  });

  it("returns a cancellation result when the user declines to open the parent folder", async () => {
    const openPath = vi.fn(async () => "");
    const confirmMissingFile = vi.fn(async () => false);

    const result = await openManualLink(
      { href: "file:///tmp/missing.txt" },
      null,
      {
        resolveManualLinkTarget: async () => ({
          ok: true,
          target: {
            kind: "fileItem",
            path: "/tmp/missing.txt",
            exists: false,
            parentDirectoryPath: "/tmp",
          },
        }),
        openPath,
        confirmMissingFile,
      },
    );

    expect(openPath).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: false,
      error: {
        code: "LINK_OPEN_CANCELLED",
        message: "リンクを開く操作を取り消しました。",
        recoverable: true,
        detail: undefined,
      },
    });
  });
});
