const { BrowserWindow, screen } = require('electron')
const path = require('path')

let toastWindow = null
let hideTimeout = null

const TOAST_WIDTH = 320
const TOAST_HEIGHT = 70
const TOAST_MARGIN = 16
const TOAST_DURATION_MS = 3000

/**
 * Show a toast notification
 * @param {Object} options
 * @param {string} options.title - Toast title
 * @param {string} options.body - Toast body text
 * @param {'success' | 'error' | 'warning' | 'info'} [options.type='info'] - Toast type for icon
 * @param {number} [options.duration=3000] - Duration in ms before auto-hide
 */
function showToast ({ title, body, type = 'info', duration = TOAST_DURATION_MS } = {}) {
  if (hideTimeout) {
    clearTimeout(hideTimeout)
    hideTimeout = null
  }

  // Reuse existing window or create new
  if (toastWindow && !toastWindow.isDestroyed()) {
    toastWindow.webContents.send('toast-data', { title, body, type })
    toastWindow.show()
  } else {
    const primaryDisplay = screen.getPrimaryDisplay()
    const { width: screenWidth } = primaryDisplay.workAreaSize

    toastWindow = new BrowserWindow({
      width: TOAST_WIDTH,
      height: TOAST_HEIGHT,
      x: screenWidth - TOAST_WIDTH - TOAST_MARGIN,
      y: TOAST_MARGIN,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      focusable: false,
      hasShadow: false,
      show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    })

    toastWindow.loadFile(path.join(__dirname, 'toast.html'))

    toastWindow.once('ready-to-show', () => {
      toastWindow.webContents.send('toast-data', { title, body, type })
      toastWindow.showInactive()
    })

    toastWindow.on('closed', () => {
      toastWindow = null
    })
  }

  console.log('Toast shown', { title, type })

  hideTimeout = setTimeout(() => {
    if (toastWindow && !toastWindow.isDestroyed()) {
      toastWindow.hide()
    }
    hideTimeout = null
  }, duration)
}

/**
 * Hide the toast immediately
 */
function hideToast () {
  if (hideTimeout) {
    clearTimeout(hideTimeout)
    hideTimeout = null
  }
  if (toastWindow && !toastWindow.isDestroyed()) {
    toastWindow.hide()
  }
}

/**
 * Destroy the toast window
 */
function destroyToast () {
  hideToast()
  if (toastWindow && !toastWindow.isDestroyed()) {
    toastWindow.destroy()
    toastWindow = null
  }
}

module.exports = {
  showToast,
  hideToast,
  destroyToast
}
