const test = require('node:test')
const assert = require('node:assert/strict')

const { showWindow } = require('../utils/window')

const createMockWindow = (overrides = {}) => {
  const state = {
    minimized: false,
    visible: false,
    showCalls: 0,
    showInactiveCalls: 0,
    focusCalls: 0,
    restoreCalls: 0
  }

  const windowInstance = {
    isMinimized: () => state.minimized,
    isVisible: () => state.visible,
    restore: () => {
      state.restoreCalls += 1
      state.minimized = false
    },
    show: () => {
      state.showCalls += 1
      state.visible = true
    },
    showInactive: () => {
      state.showInactiveCalls += 1
      state.visible = true
    },
    focus: () => {
      state.focusCalls += 1
    },
    _state: state
  }

  return { windowInstance: { ...windowInstance, ...overrides }, state }
}

test('showWindow focuses when requested and restores minimized window', () => {
  const { windowInstance, state } = createMockWindow()
  state.minimized = true

  const result = showWindow(windowInstance, { focus: true })

  assert.equal(result.shown, true)
  assert.equal(result.focused, true)
  assert.equal(state.restoreCalls, 1)
  assert.equal(state.showCalls, 1)
  assert.equal(state.focusCalls, 1)
})

test('showWindow does not steal focus when focus is false and already visible', () => {
  const { windowInstance, state } = createMockWindow()
  state.visible = true

  const result = showWindow(windowInstance, { focus: false })

  assert.equal(result.shown, false)
  assert.equal(result.focused, false)
  assert.equal(state.showCalls, 0)
  assert.equal(state.showInactiveCalls, 0)
  assert.equal(state.focusCalls, 0)
})

test('showWindow uses showInactive when available and focus is false', () => {
  const { windowInstance, state } = createMockWindow()

  const result = showWindow(windowInstance, { focus: false })

  assert.equal(result.shown, true)
  assert.equal(result.focused, false)
  assert.equal(state.showInactiveCalls, 1)
  assert.equal(state.showCalls, 0)
})

test('showWindow falls back to show when showInactive is missing', () => {
  const { windowInstance, state } = createMockWindow({ showInactive: undefined })

  const result = showWindow(windowInstance, { focus: false })

  assert.equal(result.shown, true)
  assert.equal(result.focused, false)
  assert.equal(state.showCalls, 1)
})

test('showWindow respects allowShow false', () => {
  const { windowInstance, state } = createMockWindow()

  const result = showWindow(windowInstance, { allowShow: false })

  assert.equal(result.shown, false)
  assert.equal(result.focused, false)
  assert.equal(state.showCalls, 0)
  assert.equal(state.focusCalls, 0)
})
