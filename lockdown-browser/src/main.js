import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { config, isAllowedUrl } from "./config.js";
import { configKey, safeEqual, sha256 } from "./integrity.js";
import { applySessionRules, createViolationLog, guardContents } from "./guards.js";

// In ESM, `import "electron"` resolves to the npm shim, which exports the path
// to the binary. Only the patched CJS require returns the runtime API.
const { app, BrowserWindow, Menu, screen, session, ipcMain } =
  createRequire(import.meta.url)("electron");

const here = dirname(fileURLToPath(import.meta.url));
const security = config.security;
const KEY = configKey(security);

// Ships inside the build. See the honesty note in integrity.js: this raises
// the cost of forging a request, it does not make it impossible.
const APP_SECRET = process.env.LOCKDOWN_APP_SECRET ?? "change-me-before-deploying";

let win = null;

const log = createViolationLog((entry, total) => {
  console.warn(`[lockdown] ${entry.type} ${entry.detail}`);
  win?.webContents.send("lockdown:violation", { ...entry, total });

  if (security.detectFocusLoss && entry.type === "focus-loss") {
    const losses = log.count("focus-loss");
    if (losses >= security.maxFocusLossBeforeLock) {
      win?.webContents.send("lockdown:locked", {
        reason: "Too many focus losses",
        focusLosses: losses,
      });
    }
  }
});

function createWindow() {
  win = new BrowserWindow({
    show: false,
    kiosk: security.kiosk,
    frame: !security.kiosk,
    alwaysOnTop: security.alwaysOnTop,
    autoHideMenuBar: true,
    backgroundColor: "#0d1324",
    title: config.appName,
    webPreferences: {
      preload: join(here, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: security.allowDevTools,
      spellcheck: false,
    },
  });

  if (security.alwaysOnTop) win.setAlwaysOnTop(true, "screen-saver");

  guardContents(win.webContents, { security, isAllowedUrl, log });

  if (security.detectFocusLoss) {
    win.on("blur", () => {
      log.record("focus-loss");
      // Pull focus back so leaving the exam takes deliberate effort.
      if (security.kiosk) setTimeout(() => win?.focus(), 50);
    });
  }

  // Closing is only allowed through the password-checked quit handler.
  win.on("close", event => {
    if (app.isQuitting) return;
    event.preventDefault();
    win.webContents.send("lockdown:quit-requested");
  });

  win.once("ready-to-show", () => {
    win.show();
    win.focus();
  });

  win.loadURL(config.startUrl);
}

function watchDisplays() {
  if (!security.detectDisplayChange) return;

  const count = screen.getAllDisplays().length;
  if (count > 1) log.record("multiple-displays", `${count} displays at startup`);

  screen.on("display-added", () => log.record("display-added", "a screen was connected"));
  screen.on("display-removed", () => log.record("display-removed"));
}

function registerIpc() {
  ipcMain.handle("lockdown:status", () => ({
    appName: config.appName,
    version: app.getVersion(),
    configKey: KEY,
    violations: log.entries.length,
    displays: screen.getAllDisplays().length,
    restrictions: security,
  }));

  ipcMain.handle("lockdown:report", (_event, type, detail) => {
    log.record(String(type).slice(0, 40), String(detail ?? "").slice(0, 200));
    return log.entries.length;
  });

  ipcMain.handle("lockdown:quit", (_event, password) => {
    const required = config.quitPasswordHash;

    if (required && !safeEqual(sha256(String(password ?? "")), required)) {
      log.record("bad-quit-password");
      return { ok: false, error: "Incorrect password." };
    }

    app.isQuitting = true;
    app.quit();
    return { ok: true };
  });
}

// A second copy would run outside the lockdown, so refuse to start one.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!win) return;
    win.focus();
    log.record("second-instance-blocked");
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    applySessionRules(session.defaultSession, {
      security,
      isAllowedUrl,
      log,
      key: KEY,
      secret: APP_SECRET,
      version: app.getVersion(),
    });
    registerIpc();
    watchDisplays();
    createWindow();
  });

  app.on("window-all-closed", () => app.quit());
}
