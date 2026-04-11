import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseManualDocument } from "./manual-parser";

const workspaceRoot = path.resolve(import.meta.dirname, "../..");

describe("parseManualDocument", () => {
  it("parses the sample markdown manual into phases, steps, and checks", async () => {
    const sourcePath = path.join(workspaceRoot, "samples", "workprocnavi-validation-md.md");
    const markdown = await readFile(sourcePath, "utf8");

    const manual = parseManualDocument({
      markdown,
      runtimeManualId: "runtime-test",
      sourcePath,
      sourceRootPath: path.dirname(sourcePath),
      sourceType: "markdown",
    });

    expect(manual.title).toBe("WorkProcNavi 機能確認手順（Markdown 単体版）");
    expect(manual.totals.phaseCount).toBe(3);
    expect(manual.totals.stepCount).toBe(7);
    expect(manual.totals.confirmItemCount).toBe(22);
    expect(manual.phases[1]?.steps[0]?.contentBlocks.some((block) => block.type === "code")).toBe(true);
  });

  it("rejects manuals without confirm items", () => {
    expect(() =>
      parseManualDocument({
        markdown: `# title\n\n## phase\n\n### step\n\n本文だけ`,
        runtimeManualId: "runtime-test",
        sourcePath: "/tmp/manual.md",
        sourceRootPath: "/tmp",
        sourceType: "markdown",
      }),
    ).toThrowError();
  });
});
