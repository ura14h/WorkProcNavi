import path from "node:path";
import MarkdownIt from "markdown-it";
import type Token from "markdown-it/lib/token.mjs";
import sanitizeHtml from "sanitize-html";
import { ASSET_PROTOCOL } from "../shared/constants";
import type {
  ConfirmItem,
  ManualDocument,
  Phase,
  RenderBlock,
  Step,
} from "../shared/types";
import { createError } from "./errors";
import { manualIdFromSourcePath } from "./path-utils";

type ParseInput = {
  markdown: string;
  sourcePath: string;
  sourceRootPath: string;
  sourceType: ManualDocument["sourceType"];
  runtimeManualId: string;
};

const markdown = new MarkdownIt({
  html: false,
  linkify: false,
  breaks: false,
});
markdown.validateLink = () => true;

function sanitize(html: string) {
  return sanitizeHtml(html, {
    allowedTags: [
      "a",
      "b",
      "blockquote",
      "br",
      "code",
      "em",
      "hr",
      "i",
      "li",
      "ol",
      "p",
      "pre",
      "strong",
      "table",
      "tbody",
      "td",
      "th",
      "thead",
      "tr",
      "ul",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      th: ["align"],
      td: ["align"],
      code: ["class"],
    },
    allowedSchemes: ["http", "https", "file"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        target: "_blank",
        rel: "noreferrer",
      }),
    },
  });
}

function matchingTokenIndex(
  tokens: Token[],
  startIndex: number,
): number {
  let depth = 0;
  for (let index = startIndex; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.nesting === 1) {
      depth += 1;
    } else if (token.nesting === -1) {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return startIndex;
}

function isStandaloneImageParagraph(token: Token, inlineToken?: Token) {
  if (token.type !== "paragraph_open" || !inlineToken || inlineToken.type !== "inline") {
    return false;
  }
  const children = inlineToken.children ?? [];
  return children.length === 1 && children[0]?.type === "image";
}

function toAssetUrl(runtimeManualId: string, sourceRootPath: string, rawUrl: string) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(rawUrl)) {
    return rawUrl;
  }

  const normalized = rawUrl.split(path.sep).join("/");
  return `${ASSET_PROTOCOL}://manual/${runtimeManualId}/${encodeURI(normalized)}`;
}

function renderSlice(tokens: Token[]) {
  return sanitize(markdown.renderer.render(tokens, markdown.options, {}));
}

function renderInline(sourceMarkdown: string) {
  return sanitize(markdown.renderInline(sourceMarkdown));
}

function renderBlocks(
  sourceMarkdown: string,
  runtimeManualId: string,
  sourceRootPath: string,
): RenderBlock[] {
  const tokens = markdown.parse(sourceMarkdown, {});
  const blocks: RenderBlock[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type === "paragraph_open") {
      const inlineToken = tokens[index + 1];
      if (isStandaloneImageParagraph(token, inlineToken)) {
        const imageToken = inlineToken.children?.[0];
        if (!imageToken) {
          continue;
        }
        const src = imageToken?.attrGet("src");
        if (src) {
          blocks.push({
            type: "image",
            alt: imageToken.content,
            assetUrl: toAssetUrl(runtimeManualId, sourceRootPath, src),
            title: imageToken.attrGet("title") ?? undefined,
          });
          index = matchingTokenIndex(tokens, index);
          continue;
        }
      }

      const end = matchingTokenIndex(tokens, index);
      blocks.push({ type: "paragraph", html: renderSlice(tokens.slice(index, end + 1)) });
      index = end;
      continue;
    }

    if (token.type === "bullet_list_open" || token.type === "ordered_list_open") {
      const end = matchingTokenIndex(tokens, index);
      blocks.push({ type: "list", html: renderSlice(tokens.slice(index, end + 1)) });
      index = end;
      continue;
    }

    if (token.type === "blockquote_open") {
      const end = matchingTokenIndex(tokens, index);
      blocks.push({ type: "blockquote", html: renderSlice(tokens.slice(index, end + 1)) });
      index = end;
      continue;
    }

    if (token.type === "table_open") {
      const end = matchingTokenIndex(tokens, index);
      blocks.push({ type: "table", html: renderSlice(tokens.slice(index, end + 1)) });
      index = end;
      continue;
    }

    if (token.type === "fence" || token.type === "code_block") {
      blocks.push({
        type: "code",
        language: token.info ? token.info.split(/\s+/)[0] ?? null : null,
        code: token.content,
      });
      continue;
    }

    if (token.type === "heading_open") {
      const level = Number(token.tag.replace("h", ""));
      if (level >= 4) {
        blocks.push({
          type: "heading4plus",
          level,
          text: tokens[index + 1]?.content ?? "",
        });
      }
      index = matchingTokenIndex(tokens, index);
      continue;
    }

    if (token.type === "hr") {
      blocks.push({ type: "thematicBreak" });
    }
  }

  return blocks;
}

type MutableStep = {
  title: string;
  contentLines: string[];
  confirmItems: ConfirmItem[];
};

type MutablePhase = {
  title: string;
  introLines: string[];
  steps: MutableStep[];
};

function finalizeStep(
  phaseIndex: number,
  stepIndex: number,
  step: MutableStep,
  runtimeManualId: string,
  sourceRootPath: string,
): Step {
  return {
    stepId: `phase-${String(phaseIndex).padStart(3, "0")}-step-${String(stepIndex).padStart(3, "0")}`,
    index: stepIndex,
    title: step.title,
    contentBlocks: renderBlocks(step.contentLines.join("\n").trim(), runtimeManualId, sourceRootPath),
    confirmItems: step.confirmItems,
  };
}

function finalizePhase(
  phaseIndex: number,
  phase: MutablePhase,
  runtimeManualId: string,
  sourceRootPath: string,
): Phase {
  const steps = phase.steps.map((step, stepIndex) => {
    const finalized = finalizeStep(
      phaseIndex,
      stepIndex + 1,
      step,
      runtimeManualId,
      sourceRootPath,
    );

    finalized.confirmItems = finalized.confirmItems.map((item, confirmIndex) => ({
      ...item,
      confirmItemId: `${finalized.stepId}-check-${String(confirmIndex + 1).padStart(3, "0")}`,
      index: confirmIndex + 1,
    }));

    return finalized;
  });

  const confirmItemCount = steps.reduce((sum, step) => sum + step.confirmItems.length, 0);

  return {
    phaseId: `phase-${String(phaseIndex).padStart(3, "0")}`,
    index: phaseIndex,
    title: phase.title,
    introBlocks: renderBlocks(
      phase.introLines.join("\n").trim(),
      runtimeManualId,
      sourceRootPath,
    ),
    steps,
    totals: {
      stepCount: steps.length,
      confirmItemCount,
    },
  };
}

function pushLine(target: string[], line: string) {
  target.push(line);
}

function trimmedHeading(line: string, level: 1 | 2 | 3) {
  return line.replace(new RegExp(`^\\s*#{${level}}\\s+`), "").trim();
}

export function parseManualDocument(input: ParseInput): ManualDocument {
  const lines = input.markdown.replace(/\r\n/g, "\n").split("\n");
  const overviewLines: string[] = [];
  const phases: MutablePhase[] = [];

  let title: string | null = null;
  let currentPhase: MutablePhase | null = null;
  let currentStep: MutableStep | null = null;
  let activeFence: string | null = null;

  for (const line of lines) {
    const fenceMatch = line.match(/^\s*(```+|~~~+)/);
    const fenceMarker = fenceMatch?.[1] ?? null;

    if (fenceMarker) {
      if (!activeFence) {
        activeFence = fenceMarker;
      } else if (fenceMarker.startsWith(activeFence[0])) {
        activeFence = null;
      }
    }

    if (!activeFence) {
      if (!title && /^\s*#\s+/.test(line)) {
        title = trimmedHeading(line, 1);
        continue;
      }

      if (/^\s*##\s+/.test(line)) {
        currentStep = null;
        currentPhase = {
          title: trimmedHeading(line, 2),
          introLines: [],
          steps: [],
        };
        phases.push(currentPhase);
        continue;
      }

      if (/^\s*###\s+/.test(line)) {
        if (!currentPhase) {
          throw createError(
            "MARKDOWN_INVALID_STRUCTURE",
            "フェーズ配下にステップが定義されていません。",
          );
        }

        currentStep = {
          title: trimmedHeading(line, 3),
          contentLines: [],
          confirmItems: [],
        };
        currentPhase.steps.push(currentStep);
        continue;
      }

      const confirmMatch = line.match(/^\s*[-*]\s+\[( |x|X)\]\s+(.+)\s*$/);
      if (confirmMatch && currentStep) {
        currentStep.confirmItems.push({
          confirmItemId: "",
          index: 0,
          text: confirmMatch[2].trim(),
          html: renderInline(confirmMatch[2].trim()),
        });
        continue;
      }
    }

    if (currentStep) {
      pushLine(currentStep.contentLines, line);
    } else if (currentPhase) {
      pushLine(currentPhase.introLines, line);
    } else if (title) {
      pushLine(overviewLines, line);
    }
  }

  if (!title) {
    throw createError(
      "MARKDOWN_INVALID_STRUCTURE",
      "手順書タイトルが見つかりません。",
      true,
    );
  }

  const finalizedPhases = phases.map((phase, index) =>
    finalizePhase(index + 1, phase, input.runtimeManualId, input.sourceRootPath),
  );

  if (finalizedPhases.length === 0) {
    throw createError(
      "MARKDOWN_INVALID_STRUCTURE",
      "フェーズが 1 つも定義されていません。",
      true,
    );
  }

  for (const phase of finalizedPhases) {
    if (phase.steps.length === 0) {
      throw createError(
        "MARKDOWN_INVALID_STRUCTURE",
        `フェーズ「${phase.title}」にステップがありません。`,
        true,
      );
    }

    for (const step of phase.steps) {
      if (step.confirmItems.length === 0) {
        throw createError(
          "MARKDOWN_INVALID_STRUCTURE",
          `ステップ「${step.title}」に確認項目がありません。`,
          true,
        );
      }
    }
  }

  const stepCount = finalizedPhases.reduce((sum, phase) => sum + phase.steps.length, 0);
  const confirmItemCount = finalizedPhases.reduce(
    (sum, phase) => sum + phase.totals.confirmItemCount,
    0,
  );

  return {
    manualId: manualIdFromSourcePath(input.sourcePath),
    runtimeManualId: input.runtimeManualId,
    title,
    sourceType: input.sourceType,
    sourcePath: input.sourcePath,
    sourceRootPath: input.sourceRootPath,
    displayName: path.basename(input.sourcePath),
    overviewBlocks: renderBlocks(
      overviewLines.join("\n").trim(),
      input.runtimeManualId,
      input.sourceRootPath,
    ),
    phases: finalizedPhases,
    totals: {
      phaseCount: finalizedPhases.length,
      stepCount,
      confirmItemCount,
    },
  };
}
