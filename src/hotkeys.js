const { globalShortcut } = require('electron')

const DEFAULT_CAPTURE_HOTKEY = 'CommandOrControl+Shift+J'
const DEFAULT_CLIPBOARD_HOTKEY = 'CommandOrControl+J'
let captureHotkey = null
let clipboardHotkey = null

function registerCaptureHotkey ({ onCapture, accelerator = DEFAULT_CAPTURE_HOTKEY } = {}) {
  if (typeof onCapture !== 'function') {
    console.warn('Capture hotkey registration skipped: missing handler')
    return { ok: false, reason: 'missing-handler' }
  }

  if (!accelerator) {
    console.log('Capture hotkey disabled (empty accelerator)')
    return { ok: false, reason: 'disabled' }
  }

  const success = globalShortcut.register(accelerator, () => {
    console.log('Capture hotkey triggered', { accelerator })
    try {
      onCapture()
    } catch (error) {
      console.error('Capture hotkey handler failed', error)
    }
  })

  if (!success) {
    console.warn('Capture hotkey registration failed', { accelerator })
    return { ok: false, accelerator, reason: 'registration-failed' }
  }

  captureHotkey = accelerator
  console.log('Capture hotkey registered', { accelerator })
  return { ok: true, accelerator }
}

function registerClipboardHotkey ({ onClipboard, accelerator = DEFAULT_CLIPBOARD_HOTKEY } = {}) {
  if (typeof onClipboard !== 'function') {
    console.warn('Clipboard hotkey registration skipped: missing handler')
    return { ok: false, reason: 'missing-handler' }
  }

  if (!accelerator) {
    console.log('Clipboard hotkey disabled (empty accelerator)')
    return { ok: false, reason: 'disabled' }
  }

  const success = globalShortcut.register(accelerator, () => {
    console.log('Clipboard hotkey triggered', { accelerator })
    try {
      onClipboard()
    } catch (error) {
      console.error('Clipboard hotkey handler failed', error)
    }
  })

  if (!success) {
    console.warn('Clipboard hotkey registration failed', { accelerator })
    return { ok: false, accelerator, reason: 'registration-failed' }
  }

  clipboardHotkey = accelerator
  console.log('Clipboard hotkey registered', { accelerator })
  return { ok: true, accelerator }
}

function unregisterGlobalHotkeys () {
  if (captureHotkey) {
    globalShortcut.unregister(captureHotkey)
    console.log('Capture hotkey unregistered', { accelerator: captureHotkey })
    captureHotkey = null
  }

  if (clipboardHotkey) {
    globalShortcut.unregister(clipboardHotkey)
    console.log('Clipboard hotkey unregistered', { accelerator: clipboardHotkey })
    clipboardHotkey = null
  }
}

module.exports = {
  DEFAULT_CAPTURE_HOTKEY,
  DEFAULT_CLIPBOARD_HOTKEY,
  registerCaptureHotkey,
  registerClipboardHotkey,
  unregisterGlobalHotkeys
}
