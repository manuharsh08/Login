/**
 * The restriction logic, kept separate from app wiring so it can be exercised
 * by an integration test without opening a kiosk window.
 */
import { requestHash } from "./integrity.js";

/** Collects violations and notifies a listener. */
export function createViolationLog(onViolation = () => {}) {
  const entries = [];

  return {
    entries,
    record(type, detail = "") {
      const entry = { type, detail, at: new Date().toISOString() };
      entries.push(entry);
      onViolation(entry, entries.length);
      return entry;
    },
    count(type) {
      return entries.filter(entry => entry.type === type).length;
    },
  };
}

/**
 * Session-level rules: attestation headers, origin allowlisting, downloads and
 * permissions.
 */
export function applySessionRules(ses, { security, isAllowedUrl, log, key, secret, version }) {
  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    const requestHeaders = { ...details.requestHeaders };

    // Only sign requests to the exam origins — never leak the proof elsewhere.
    if (isAllowedUrl(details.url)) {
      requestHeaders["X-Lockdown-Hash"] = requestHash(details.url, key, secret);
      requestHeaders["X-Lockdown-Config-Key"] = key;
      requestHeaders["X-Lockdown-Version"] = version;
    }

    callback({ requestHeaders });
  });

  ses.webRequest.onBeforeRequest((details, callback) => {
    const internal =
      details.url.startsWith("devtools://") ||
      details.url.startsWith("blob:") ||
      details.url.startsWith("data:");

    if (internal || isAllowedUrl(details.url)) return callback({});

    log.record("blocked-request", details.url.slice(0, 120));
    callback({ cancel: true });
  });

  if (!security.allowDownloads) {
    ses.on("will-download", event => {
      event.preventDefault();
      log.record("download-blocked");
    });
  }

  ses.setPermissionRequestHandler((_contents, permission, callback) => {
    const allowed =
      (permission === "media" && (security.allowCamera || security.allowMicrophone)) ||
      permission === "fullscreen";

    if (!allowed) log.record("permission-denied", permission);
    callback(allowed);
  });
}

/** Decides whether a key combination should be swallowed. */
export function isBlockedShortcut(input, security) {
  if (input.type !== "keyDown") return null;

  const mod = input.control || input.meta;
  const key = (input.key ?? "").toLowerCase();

  const rules = {
    devtools: (key === "f12" || (mod && input.shift && ["i", "j", "c"].includes(key))) && !security.allowDevTools,
    "view-source": mod && key === "u",
    print: mod && key === "p" && !security.allowPrinting,
    save: mod && key === "s",
    reload: key === "f5" || (mod && key === "r"),
    "new-window": mod && ["t", "n"].includes(key),
    "close-quit": mod && ["w", "q", "m", "h"].includes(key),
    find: mod && key === "f",
    clipboard: !security.allowClipboard && mod && ["c", "v", "x", "a"].includes(key),
  };

  return Object.entries(rules).find(([, hit]) => hit)?.[0] ?? null;
}

/** Window-level rules: input, context menu, popups and navigation. */
export function guardContents(contents, { security, isAllowedUrl, log }) {
  contents.on("before-input-event", (event, input) => {
    const blocked = isBlockedShortcut(input, security);
    if (!blocked) return;

    event.preventDefault();
    log.record("shortcut-blocked", blocked);
  });

  if (!security.allowContextMenu) {
    contents.on("context-menu", event => event.preventDefault());
  }

  if (!security.allowNewWindows) {
    contents.setWindowOpenHandler(({ url }) => {
      log.record("popup-blocked", String(url).slice(0, 120));
      return { action: "deny" };
    });
  }

  for (const name of ["will-navigate", "will-redirect"]) {
    contents.on(name, (event, url) => {
      if (isAllowedUrl(url)) return;
      event.preventDefault();
      log.record("navigation-blocked", String(url).slice(0, 120));
    });
  }

  contents.on("render-process-gone", (_event, details) =>
    log.record("renderer-crashed", details.reason)
  );
}
