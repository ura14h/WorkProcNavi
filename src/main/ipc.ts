import { BrowserWindow, clipboard, ipcMain } from "electron";
import type { RuntimeRegistry } from "./runtime-registry";
import { exportEvidence } from "./evidence-writer";
import { loadDroppedFile } from "./manual-loader";
import { deleteSession, saveSession } from "./session-store";
import { fromUnknown } from "./errors";
import type { ExportEvidenceInput, SaveSessionInput } from "../shared/types";

export function registerIpcHandlers(runtimeRegistry: RuntimeRegistry) {
  ipcMain.handle("workprocnavi:loadDroppedFile", async (_event, filePath: string) => {
    return loadDroppedFile(filePath, runtimeRegistry);
  });

  ipcMain.handle("workprocnavi:saveSession", async (_event, input: SaveSessionInput) => {
    try {
      const saved = await saveSession(input.session);
      return { ok: true, savedAt: saved.updatedAt } as const;
    } catch (error) {
      return {
        ok: false,
        error: fromUnknown("SESSION_SAVE_FAILED", "セッション保存に失敗しました。", error),
      } as const;
    }
  });

  ipcMain.handle("workprocnavi:exportEvidence", async (_event, input: ExportEvidenceInput) => {
    try {
      const outputPath = await exportEvidence(input);
      if (input.session.sessionFilePath) {
        await deleteSession(input.session.sessionFilePath);
      }
      await runtimeRegistry.abandon(input.manual.runtimeManualId);
      return { ok: true, outputPath } as const;
    } catch (error) {
      return {
        ok: false,
        error: fromUnknown("EVIDENCE_EXPORT_FAILED", "エビデンス出力に失敗しました。", error),
      } as const;
    }
  });

  ipcMain.handle("workprocnavi:abandonRuntime", async (_event, runtimeManualId: string) => {
    await runtimeRegistry.abandon(runtimeManualId);
  });

  ipcMain.handle("workprocnavi:copyText", async (_event, text: string) => {
    clipboard.writeText(text);
  });

  ipcMain.on("workprocnavi:focusWindow", (event) => {
    BrowserWindow.fromWebContents(event.sender)?.focus();
  });
}
