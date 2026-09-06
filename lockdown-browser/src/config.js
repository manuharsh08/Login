/**
 * Exam configuration for the lockdown browser.
 *
 * Everything under `security` is hashed into the Config Key, so changing any
 * of it produces a different key and the server will reject the app until the
 * new key is registered. That is deliberate: it stops someone relaxing the
 * restrictions locally and still being allowed to sit the exam.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

const defaults = {
  appName: "Exam Portal Lockdown",

  /** Page the browser opens on launch. */
  startUrl: "http://localhost:5173/index.html",

  security: {
    /** Only these origins may be loaded. Everything else is refused. */
    allowedOrigins: ["http://localhost:5173"],

    /** Navigation, input and window restrictions. */
    kiosk: true,
    alwaysOnTop: true,
    allowDevTools: false,
    allowContextMenu: false,
    allowDownloads: false,
    allowPrinting: false,
    allowClipboard: false,
    allowNewWindows: false,

    /** Monitoring. A violation is recorded and forwarded to the exam page. */
    detectFocusLoss: true,
    detectDisplayChange: true,
    maxFocusLossBeforeLock: 3,

    /** Media permissions, off unless an exam needs proctoring video. */
    allowCamera: false,
    allowMicrophone: false,
  },

  /**
   * SHA-256 of the password that permits quitting. Never store the password.
   * Generate with: npm run hash-password -- "your password"
   */
  quitPasswordHash: "",
};

/**
 * `exam.config.json` sitting next to the app overrides these defaults, so one
 * build can serve several exams without recompiling.
 */
function loadOverrides() {
  const file = join(here, "..", "exam.config.json");
  if (!existsSync(file)) return {};

  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    console.error(`Ignoring malformed exam.config.json: ${error.message}`);
    return {};
  }
}

const overrides = loadOverrides();

export const config = {
  ...defaults,
  ...overrides,
  security: { ...defaults.security, ...(overrides.security ?? {}) },
};

/** True when `url` sits on one of the allowed origins. */
export function isAllowedUrl(url) {
  try {
    const { origin } = new URL(url);
    return config.security.allowedOrigins.includes(origin);
  } catch {
    return false;
  }
}
