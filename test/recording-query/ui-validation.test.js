const test = require('node:test')
const assert = require('node:assert/strict')

const makeElement = (initialValue = '') => {
  const element = {
    value: initialValue,
    textContent: '',
    disabled: false,
    hidden: false,
    handlers: {},
    classList: {
      toggle: (_cls, hidden) => {
        element.hidden = Boolean(hidden)
      }
    },
    addEventListener: (event, handler) => {
      element.handlers[event] = handler
    }
  }
  return element
}

test('recording query UI validates missing question', () => {
  const originalWindow = global.window
  global.window = {}
  const { createRecording } = require('../../src/dashboard/recording')

  const recordingQueryQuestion = makeElement('')
  const recordingQueryFrom = makeElement('2025-01-01')
  const recordingQueryTo = makeElement('2025-01-01')
  const recordingQuerySubmit = makeElement()
  const recordingQueryError = makeElement()
  const recordingQueryAnswer = makeElement()
  const recordingQueryAvailability = makeElement()
  const recordingQueryEstimate = makeElement()
  const recordingQuerySpinner = makeElement()
  const recordingQueryStatus = makeElement()

  const api = createRecording({
    elements: {
      recordingQueryQuestion,
      recordingQueryFrom,
      recordingQueryTo,
      recordingQuerySubmit,
      recordingQueryError,
      recordingQueryAnswer,
      recordingQueryAvailability,
      recordingQueryEstimate,
      recordingQuerySpinner,
      recordingQueryStatus
    },
    jiminy: {
      runRecordingQuery: async () => ({ ok: true, answerText: 'ok' }),
      getRecordingQueryAvailability: async () => ({ available: true }),
      getRecordingQueryEstimate: async () => ({ ok: true, totalDurationMs: 0, totalSessions: 0, totalSegments: 0 })
    },
    getState: () => ({
      currentContextFolderPath: '/tmp',
      currentAlwaysRecordWhenActive: false,
      currentLlmProviderName: 'gemini',
      currentLlmApiKey: 'key'
    })
  })

  api.updateRecordingUI()
  recordingQuerySubmit.handlers.click()

  assert.equal(recordingQueryError.textContent, 'Question is required.')

  global.window = originalWindow
})

test('recording query UI shows query folder path', async () => {
  const originalWindow = global.window
  global.window = {}
  const { createRecording } = require('../../src/dashboard/recording')

  const recordingQueryQuestion = makeElement('What happened?')
  const recordingQueryFrom = makeElement('2025-01-01')
  const recordingQueryTo = makeElement('2025-01-01')
  const recordingQuerySubmit = makeElement()
  const recordingQueryError = makeElement()
  const recordingQueryAnswer = makeElement()
  const recordingQueryAvailability = makeElement()
  const recordingQueryEstimate = makeElement()
  const recordingQuerySpinner = makeElement()
  const recordingQueryStatus = makeElement()
  const recordingQueryPath = makeElement()

  const api = createRecording({
    elements: {
      recordingQueryQuestion,
      recordingQueryFrom,
      recordingQueryTo,
      recordingQuerySubmit,
      recordingQueryError,
      recordingQueryAnswer,
      recordingQueryAvailability,
      recordingQueryEstimate,
      recordingQuerySpinner,
      recordingQueryStatus,
      recordingQueryPath
    },
    jiminy: {
      runRecordingQuery: async () => ({
        ok: true,
        answerText: 'ok',
        queryDir: '/tmp/query-123'
      }),
      getRecordingQueryAvailability: async () => ({ available: true }),
      getRecordingQueryEstimate: async () => ({ ok: true, totalDurationMs: 0, totalSessions: 0, totalSegments: 0 })
    },
    getState: () => ({
      currentContextFolderPath: '/tmp',
      currentAlwaysRecordWhenActive: false,
      currentLlmProviderName: 'gemini',
      currentLlmApiKey: 'key'
    })
  })

  api.updateRecordingUI()
  recordingQuerySubmit.handlers.click()

  await new Promise((resolve) => setImmediate(resolve))

  assert.equal(recordingQueryPath.textContent, 'Saved to /tmp/query-123')

  global.window = originalWindow
})

test('recording UI opens the recordings folder from the path button', async () => {
  const originalWindow = global.window
  global.window = {}
  const { createRecording } = require('../../src/dashboard/recording')

  const recordingPath = makeElement()
  const recordingOpenFolderButton = makeElement()
  let openCalls = 0

  const api = createRecording({
    elements: {
      recordingPath,
      recordingOpenFolderButton
    },
    jiminy: {
      openRecordingFolder: async () => {
        openCalls += 1
        return { ok: true }
      }
    },
    getState: () => ({
      currentContextFolderPath: '/tmp',
      currentAlwaysRecordWhenActive: false,
      currentLlmProviderName: 'gemini',
      currentLlmApiKey: 'key'
    })
  })

  api.updateRecordingUI()
  assert.equal(recordingPath.textContent, '/tmp/jiminy/recordings')
  assert.equal(recordingOpenFolderButton.disabled, false)
  assert.equal(recordingOpenFolderButton.hidden, false)

  await recordingOpenFolderButton.handlers.click()

  assert.equal(openCalls, 1)

  global.window = originalWindow
})

test('recording UI hides folder button without context path', () => {
  const originalWindow = global.window
  global.window = {}
  const { createRecording } = require('../../src/dashboard/recording')

  const recordingOpenFolderButton = makeElement()

  const api = createRecording({
    elements: { recordingOpenFolderButton },
    jiminy: { openRecordingFolder: async () => ({ ok: true }) },
    getState: () => ({
      currentContextFolderPath: '',
      currentAlwaysRecordWhenActive: false,
      currentLlmProviderName: 'gemini',
      currentLlmApiKey: 'key'
    })
  })

  api.updateRecordingUI()

  assert.equal(recordingOpenFolderButton.disabled, true)
  assert.equal(recordingOpenFolderButton.hidden, true)

  global.window = originalWindow
})
