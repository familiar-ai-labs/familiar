/**
 * This file is loaded via the <script> tag in the index.html file and will
 * be executed in the renderer process for that window. No Node.js APIs are
 * available in this process because `nodeIntegration` is turned off and
 * `contextIsolation` is turned on. Use the contextBridge API in `preload.js`
 * to expose Node.js functionality from the main process.
 */
const setText = (id, value) => {
  const element = document.getElementById(id)
  if (element) {
    element.textContent = value
  }
}

const jiminy = window.jiminy || {}
setText('platform', jiminy.platform || 'unknown')
setText('electron-version', jiminy.electronVersion || 'unknown')
setText('node-version', jiminy.nodeVersion || 'unknown')
setText('started-at', new Date().toLocaleString())
