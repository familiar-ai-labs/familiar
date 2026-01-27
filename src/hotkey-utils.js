/**
 * Convert a KeyboardEvent (or event-like object) to an Electron accelerator string
 * @param {Object} event - Object with metaKey, ctrlKey, altKey, shiftKey, and key properties
 * @returns {string|null} - Electron accelerator string or null if invalid
 */
function keyEventToAccelerator(event) {
  const parts = []

  // Modifiers - use CommandOrControl for cross-platform compatibility
  if (event.metaKey || event.ctrlKey) {
    parts.push('CommandOrControl')
  }
  if (event.altKey) {
    parts.push('Alt')
  }
  if (event.shiftKey) {
    parts.push('Shift')
  }

  const keyFromCode = (code) => {
    if (typeof code !== 'string' || code.length === 0) {
      return null
    }

    if (code.startsWith('Key') && code.length === 4) {
      return code.slice(3)
    }
    if (code.startsWith('Digit') && code.length === 6) {
      return code.slice(5)
    }
    if (code.startsWith('Numpad')) {
      const numpadKey = code.slice(6)
      if (/^\d$/.test(numpadKey)) {
        return numpadKey
      }
    }

    const codeMap = {
      Minus: '-',
      Equal: '=',
      BracketLeft: '[',
      BracketRight: ']',
      Backslash: '\\',
      Semicolon: ';',
      Quote: "'",
      Comma: ',',
      Period: '.',
      Slash: '/',
      Backquote: '`'
    }

    return codeMap[code] || null
  }

  const isSingleAscii = (value) =>
    typeof value === 'string' &&
    value.length === 1 &&
    value.charCodeAt(0) >= 32 &&
    value.charCodeAt(0) <= 126

  // Get the actual key
  let key = event.key

  // Skip if only modifier keys are pressed
  if (['Meta', 'Control', 'Alt', 'Shift'].includes(key)) {
    return null
  }

  // Map special keys to Electron accelerator names
  const keyMap = {
    ' ': 'Space',
    'ArrowUp': 'Up',
    'ArrowDown': 'Down',
    'ArrowLeft': 'Left',
    'ArrowRight': 'Right',
    'Escape': 'Escape',
    'Enter': 'Return',
    'Backspace': 'Backspace',
    'Delete': 'Delete',
    'Tab': 'Tab',
    'Home': 'Home',
    'End': 'End',
    'PageUp': 'PageUp',
    'PageDown': 'PageDown',
    'Insert': 'Insert'
  }

  if (keyMap[key]) {
    key = keyMap[key]
  } else if (key.length === 1) {
    if (isSingleAscii(key)) {
      // Single character - uppercase it
      key = key.toUpperCase()
    } else {
      const codeKey = keyFromCode(event.code)
      if (!codeKey) {
        return null
      }
      key = codeKey
    }
  } else if (key.startsWith('F') && /^F\d+$/.test(key)) {
    // Function keys (F1-F12) - keep as is
  } else {
    const codeKey = keyFromCode(event.code)
    if (codeKey) {
      key = codeKey
    } else {
      // Unknown key
      return null
    }
  }

  // Must have at least one modifier for a global hotkey
  if (parts.length === 0) {
    return null
  }

  parts.push(key)
  return parts.join('+')
}

/**
 * Format an accelerator string for display with platform-specific symbols
 * @param {string} accelerator - Electron accelerator string
 * @param {string} platform - Platform string ('darwin' for Mac, others for Windows/Linux)
 * @returns {string} - Human-readable display string
 */
function formatAcceleratorForDisplay(accelerator, platform = 'darwin') {
  if (!accelerator) return 'Click to set...'

  const isMac = platform === 'darwin'
  return accelerator
    .replace(/CommandOrControl/g, isMac ? '⌘' : 'Ctrl')
    .replace(/Command/g, '⌘')
    .replace(/Control/g, 'Ctrl')
    .replace(/Alt/g, isMac ? '⌥' : 'Alt')
    .replace(/Shift/g, isMac ? '⇧' : 'Shift')
    .replace(/\+/g, ' + ')
}

/**
 * Validate an accelerator string
 * @param {string} accelerator - Electron accelerator string
 * @returns {Object} - { valid: boolean, reason?: string }
 */
function validateAccelerator(accelerator) {
  if (!accelerator || typeof accelerator !== 'string') {
    return { valid: false, reason: 'empty' }
  }

  const parts = accelerator.split('+')
  if (parts.length < 2) {
    return { valid: false, reason: 'no-modifier' }
  }

  const modifiers = ['CommandOrControl', 'Command', 'Control', 'Ctrl', 'Alt', 'Shift', 'Meta', 'Super']
  const hasModifier = parts.some(p => modifiers.includes(p))
  if (!hasModifier) {
    return { valid: false, reason: 'no-modifier' }
  }

  return { valid: true }
}

module.exports = {
  keyEventToAccelerator,
  formatAcceleratorForDisplay,
  validateAccelerator
}
