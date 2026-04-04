import { contextBridge, ipcRenderer, webUtils } from "electron";
import type { WorkProcNaviApi } from "./shared/types";

const api: WorkProcNaviApi = {
  loadDroppedFile: (filePath) => ipcRenderer.invoke("workprocnavi:loadDroppedFile", filePath),
  saveSession: (input) => ipcRenderer.invoke("workprocnavi:saveSession", input),
  exportEvidence: (input) => ipcRenderer.invoke("workprocnavi:exportEvidence", input),
  abandonRuntime: (runtimeManualId) =>
    ipcRenderer.invoke("workprocnavi:abandonRuntime", runtimeManualId),
  copyText: (text) => ipcRenderer.invoke("workprocnavi:copyText", text),
  getPathForFile: (file) => webUtils.getPathForFile(file),
};

contextBridge.exposeInMainWorld("workProcNavi", api);
