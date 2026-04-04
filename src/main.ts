import { app, BrowserWindow, dialog, protocol } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerAssetProtocol } from "./main/asset-protocol";
import { registerIpcHandlers } from "./main/ipc";
import { RuntimeRegistry } from "./main/runtime-registry";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const runtimeRegistry = new RuntimeRegistry();

let mainWindow: BrowserWindow | null = null;
let allowWindowClose = false;
let closeGuardEnabled = false;

function createMainWindow() {
  allowWindowClose = false;
  closeGuardEnabled = false;
  const preloadPath = path.join(__dirname, "preload.cjs");
  const rendererEntryPath = path.resolve(__dirname, "..", "dist", "index.html");

  mainWindow = new BrowserWindow({
    width: 920,
    height: 700,
    minWidth: 520,
    minHeight: 420,
    backgroundColor: "#f6efe5",
    title: "作業手順ナビ",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      preload: preloadPath,
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    void mainWindow.loadFile(rendererEntryPath);
  }

  mainWindow.on("close", async (event) => {
    if (allowWindowClose || !closeGuardEnabled) {
      return;
    }

    event.preventDefault();
    const response = await dialog.showMessageBox(mainWindow!, {
      type: "question",
      buttons: ["閉じる", "キャンセル"],
      defaultId: 1,
      cancelId: 1,
      noLink: true,
      title: "作業手順ナビ",
      message: "作業はまだ完了していません。終了しますか。",
      detail: "閉じると進行中の画面は終了します。",
    });

    if (response.response === 0) {
      allowWindowClose = true;
      mainWindow?.close();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  registerAssetProtocol(protocol, runtimeRegistry);
  registerIpcHandlers(runtimeRegistry, {
    setCloseGuardEnabled: (enabled) => {
      closeGuardEnabled = enabled;
    },
  });
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("before-quit", () => {
  allowWindowClose = true;
  void runtimeRegistry.abandonAll();
});
