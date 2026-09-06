/**
 * The only bridge between the exam page and the lockdown browser.
 *
 * CommonJS on purpose: sandboxed preload scripts cannot be ES modules.
 * Nothing from Node is exposed — only these named channels — so a compromised
 * exam page cannot reach the file system or spawn processes.
 */
const { contextBridge, ipcRenderer } = require("electron");

const listeners = { violation: [], locked: [], quitRequested: [] };

function emit(name, payload) {
  listeners[name].forEach(fn => {
    try {
      fn(payload);
    } catch (error) {
      console.error(`lockdown listener for "${name}" threw:`, error);
    }
  });
}

ipcRenderer.on("lockdown:violation", (_e, payload) => emit("violation", payload));
ipcRenderer.on("lockdown:locked", (_e, payload) => emit("locked", payload));
ipcRenderer.on("lockdown:quit-requested", () => emit("quitRequested"));

contextBridge.exposeInMainWorld("lockdown", {
  /** Marks the page as running inside the lockdown browser. */
  present: true,

  /** Config key, version, restriction set and violation count. */
  status: () => ipcRenderer.invoke("lockdown:status"),

  /** Lets the exam page record its own violations (blur, paste attempts). */
  report: (type, detail) => ipcRenderer.invoke("lockdown:report", type, detail),

  /** Quitting requires the invigilator password. */
  quit: password => ipcRenderer.invoke("lockdown:quit", password),

  /** @param {"violation"|"locked"|"quitRequested"} event */
  on(event, handler) {
    if (!listeners[event]) throw new Error(`Unknown lockdown event: ${event}`);
    listeners[event].push(handler);
    return () => {
      listeners[event] = listeners[event].filter(fn => fn !== handler);
    };
  },
});
