const { globalShortcut } = require('electron')

const DEFAULT_CLIPBOARD_HOTKEY = 'CommandOrControl+J'
const DEFAULT_RECORDING_HOTKEY = 'CommandOrControl+R'
let clipboardHotkey = null
let recordingHotkey = null

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

function registerRecordingHotkey ({ onRecording, accelerator = DEFAULT_RECORDING_HOTKEY } = {}) {
  if (typeof onRecording !== 'function') {
    console.warn('Recording hotkey registration skipped: missing handler')
    return { ok: false, reason: 'missing-handler' }
  }

  if (!accelerator) {
    console.log('Recording hotkey disabled (empty accelerator)')
    return { ok: false, reason: 'disabled' }
  }

  const success = globalShortcut.register(accelerator, () => {
    console.log('Recording hotkey triggered', { accelerator })
    try {
      onRecording()
    } catch (error) {
      console.error('Recording hotkey handler failed', error)
    }
  })

  if (!success) {
    console.warn('Recording hotkey registration failed', { accelerator })
    return { ok: false, accelerator, reason: 'registration-failed' }
  }

  recordingHotkey = accelerator
  console.log('Recording hotkey registered', { accelerator })
  return { ok: true, accelerator }
}

function unregisterGlobalHotkeys () {
  if (clipboardHotkey) {
    globalShortcut.unregister(clipboardHotkey)
    console.log('Clipboard hotkey unregistered', { accelerator: clipboardHotkey })
    clipboardHotkey = null
  }

  if (recordingHotkey) {
    globalShortcut.unregister(recordingHotkey)
    console.log('Recording hotkey unregistered', { accelerator: recordingHotkey })
    recordingHotkey = null
  }
}

module.exports = {
  DEFAULT_CLIPBOARD_HOTKEY,
  DEFAULT_RECORDING_HOTKEY,
  registerClipboardHotkey,
  registerRecordingHotkey,
  unregisterGlobalHotkeys
}
