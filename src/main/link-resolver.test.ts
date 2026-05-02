import { describe, expect, it } from "vitest";
import { fileUrlToOsPath, resolveManualLinkTarget } from "./link-resolver";

describe("fileUrlToOsPath", () => {
  it("normalizes POSIX file URLs", () => {
    expect(fileUrlToOsPath("file:///tmp/workprocnavi%20sample.txt", "darwin")).toBe(
      "/tmp/workprocnavi sample.txt",
    );
  });

  it("normalizes Windows drive file URLs", () => {
    expect(fileUrlToOsPath("file:///C:/Temp/workprocnavi%20sample.txt", "win32")).toBe(
      "C:\\Temp\\workprocnavi sample.txt",
    );
  });

  it("normalizes Windows UNC file URLs", () => {
    expect(fileUrlToOsPath("file://server/share/workprocnavi%20sample.txt", "win32")).toBe(
      "\\\\server\\share\\workprocnavi sample.txt",
    );
  });
});

describe("resolveManualLinkTarget", () => {
  it("accepts external URLs", async () => {
    const result = await resolveManualLinkTarget("https://example.com/path");

    expect(result).toEqual({
      ok: true,
      target: { kind: "externalUrl", url: "https://example.com/path" },
    });
  });

  it("resolves file URLs that point to directories", async () => {
    const result = await resolveManualLinkTarget("file:///tmp", {
      platform: "darwin",
      stat: async () => ({ isDirectory: () => true }),
    });

    expect(result).toEqual({
      ok: true,
      target: { kind: "fileDirectory", path: "/tmp" },
    });
  });

  it("resolves file URLs that point to files without changing them into openable files", async () => {
    const result = await resolveManualLinkTarget("file:///tmp/workprocnavi-sample.txt", {
      platform: "darwin",
      stat: async () => ({ isDirectory: () => false }),
    });

    expect(result).toEqual({
      ok: true,
      target: {
        kind: "fileItem",
        path: "/tmp/workprocnavi-sample.txt",
        exists: true,
        parentDirectoryPath: "/tmp",
      },
    });
  });

  it("treats missing file URLs as revealable when the parent directory exists", async () => {
    const result = await resolveManualLinkTarget("file:///tmp/workprocnavi-sample.txt", {
      platform: "darwin",
      stat: async (targetPath) => {
        if (targetPath === "/tmp") {
          return { isDirectory: () => true };
        }
        throw new Error("missing");
      },
    });

    expect(result).toEqual({
      ok: true,
      target: {
        kind: "fileItem",
        path: "/tmp/workprocnavi-sample.txt",
        exists: false,
        parentDirectoryPath: "/tmp",
      },
    });
  });

  it("rejects missing directory targets even when their parent exists", async () => {
    const result = await resolveManualLinkTarget("file:///tmp/workprocnavi-missing-dir/", {
      platform: "darwin",
      stat: async (targetPath) => {
        if (targetPath === "/tmp") {
          return { isDirectory: () => true };
        }
        throw new Error("missing");
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("LINK_TARGET_NOT_FOUND");
      expect(result.error.detail).toBeUndefined();
    }
  });

  it("rejects unsupported protocols", async () => {
    const result = await resolveManualLinkTarget("javascript:alert(1)");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("LINK_UNSUPPORTED_PROTOCOL");
      expect(result.error.detail).toBeUndefined();
    }
  });

  it("rejects missing file targets", async () => {
    const result = await resolveManualLinkTarget("file:///tmp/missing.txt", {
      platform: "darwin",
      stat: async () => {
        throw new Error("missing");
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("LINK_TARGET_NOT_FOUND");
      expect(result.error.detail).toBeUndefined();
    }
  });
});
