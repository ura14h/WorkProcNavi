import { app, BrowserWindow, protocol } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerAssetProtocol } from "./main/asset-protocol";
import { registerIpcHandlers } from "./main/ipc";
import { RuntimeRegistry } from "./main/runtime-registry";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const runtimeRegistry = new RuntimeRegistry();

let mainWindow: BrowserWindow | null = null;

function createMainWindow() {
  const preloadPath = path.join(__dirname, "preload.cjs");

  mainWindow = new BrowserWindow({
    width: 1180,
    height: 860,
    minWidth: 760,
    minHeight: 640,
    backgroundColor: "#f6efe5",
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
    void mainWindow.loadFile(path.join(process.cwd(), "dist", "index.html"));
  }
}

app.whenReady().then(() => {
  registerAssetProtocol(protocol, runtimeRegistry);
  registerIpcHandlers(runtimeRegistry);
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  void runtimeRegistry.abandonAll();
});
