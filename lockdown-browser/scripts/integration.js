/**
 * Runs the real guards inside real Electron against a throwaway local server.
 * Uses a hidden window so it never takes over the screen.
 *
 *   npx electron scripts/integration.js
 */
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { configKey, requestHash } from "../src/integrity.js";
import { applySessionRules, createViolationLog, guardContents, isBlockedShortcut } from "../src/guards.js";

// In ESM, `import "electron"` resolves to the npm shim, which exports the path
// to the binary. Only the patched CJS require returns the runtime API.
const { app, BrowserWindow, session } = createRequire(import.meta.url)("electron");

const here = dirname(fileURLToPath(import.meta.url));

let pass = 0;
let fail = 0;
const check = (name, ok, detail = "") => {
  if (ok) pass += 1;
  else fail += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
};

const security = {
  allowedOrigins: [],
  kiosk: false,
  alwaysOnTop: false,
  allowDevTools: false,
  allowContextMenu: false,
  allowDownloads: false,
  allowPrinting: false,
  allowClipboard: false,
  allowNewWindows: false,
  detectFocusLoss: true,
  detectDisplayChange: true,
  maxFocusLossBeforeLock: 3,
  allowCamera: false,
  allowMicrophone: false,
};

const SECRET = "integration-secret";
const seen = [];

const server = createServer((req, res) => {
  seen.push({ url: req.url, headers: req.headers });

  if (req.url.startsWith("/offsite")) {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end("<html><body>offsite</body></html>");
    return;
  }

  res.writeHead(200, { "Content-Type": "text/html" });
  res.end("<html><body><h1>Exam</h1><p id=t>ok</p></body></html>");
});

await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const origin = `http://127.0.0.1:${port}`;
security.allowedOrigins.push(origin);

const KEY = configKey(security);
const isAllowedUrl = url => {
  try {
    return security.allowedOrigins.includes(new URL(url).origin);
  } catch {
    return false;
  }
};

await app.whenReady();

const log = createViolationLog();
applySessionRules(session.defaultSession, {
  security,
  isAllowedUrl,
  log,
  key: KEY,
  secret: SECRET,
  version: "1.0.0",
});

const win = new BrowserWindow({
  show: false,
  webPreferences: {
    preload: join(here, "..", "src", "preload.cjs"),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    devTools: false,
  },
});
guardContents(win.webContents, { security, isAllowedUrl, log });

console.log("\n=== attestation header ===");
await win.loadURL(`${origin}/exam/1`);

const examRequest = seen.find(r => r.url === "/exam/1");
check("request reached the server", Boolean(examRequest));
check("X-Lockdown-Hash present", Boolean(examRequest?.headers["x-lockdown-hash"]));
check(
  "hash matches what the server computes",
  examRequest?.headers["x-lockdown-hash"] === requestHash(`${origin}/exam/1`, KEY, SECRET),
  "server can verify independently"
);
check("config key sent", examRequest?.headers["x-lockdown-config-key"] === KEY);
check("version sent", examRequest?.headers["x-lockdown-version"] === "1.0.0");

console.log("\n=== off-origin requests ===");
const before = seen.length;
const blocked = await win.webContents
  .executeJavaScript(`fetch("https://example.com/cheat").then(() => "loaded").catch(() => "blocked")`)
  .catch(() => "blocked");
check("external fetch is blocked", blocked === "blocked", String(blocked));
check("nothing new hit the local server", seen.length === before);
check("violation was recorded", log.count("blocked-request") > 0, `${log.count("blocked-request")} recorded`);

console.log("\n=== navigation guard ===");
const navBefore = log.count("navigation-blocked");
win.webContents.emit("will-navigate", { preventDefault: () => {} }, "https://google.com");
check("off-origin navigation refused", log.count("navigation-blocked") === navBefore + 1);
win.webContents.emit("will-navigate", { preventDefault: () => {} }, `${origin}/exam/2`);
check("same-origin navigation allowed", log.count("navigation-blocked") === navBefore + 1);

console.log("\n=== keyboard restrictions ===");
const key = (k, extra = {}) => isBlockedShortcut({ type: "keyDown", key: k, ...extra }, security);
check("F12 blocked", key("F12") === "devtools");
check("Cmd+Shift+I blocked", key("i", { meta: true, shift: true }) === "devtools");
check("Ctrl+U blocked", key("u", { control: true }) === "view-source");
check("Ctrl+P blocked", key("p", { control: true }) === "print");
check("Ctrl+R blocked", key("r", { control: true }) === "reload");
check("Cmd+Q blocked", key("q", { meta: true }) === "close-quit");
check("Ctrl+C blocked when clipboard off", key("c", { control: true }) === "clipboard");
check("plain typing allowed", key("a") === null);
check("keyUp ignored", isBlockedShortcut({ type: "keyUp", key: "F12" }, security) === null);

console.log("\n=== preload bridge ===");
const bridge = await win.webContents.executeJavaScript(
  `({ present: window.lockdown?.present === true,
      api: Object.keys(window.lockdown ?? {}).sort().join(","),
      leaked: typeof window.require + "/" + typeof window.process })`
);
check("window.lockdown exposed", bridge.present);
check("api surface", bridge.api === "on,present,quit,report,status", bridge.api);
check("no Node leaked into the page", bridge.leaked === "undefined/undefined", bridge.leaked);

console.log("\n=== popups ===");
const popupBefore = log.count("popup-blocked");
const handler = win.webContents._windowOpenHandler;
check("window.open denied", handler ? handler({ url: "https://x.com" }).action === "deny" : false);
check("popup logged", log.count("popup-blocked") === popupBefore + 1);

server.close();
console.log(`\n${pass}/${pass + fail} passed`);
app.exit(fail ? 1 : 0);
