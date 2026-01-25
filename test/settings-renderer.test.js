const assert = require('node:assert/strict')
const path = require('node:path')
const { test } = require('node:test')

class TestElement {
  constructor() {
    this.style = {}
    this.classList = {
      toggle: () => {},
      add: () => {},
      remove: () => {},
      contains: () => false
    }
    this.hidden = false
    this.disabled = false
    this.value = ''
    this.textContent = ''
    this.title = ''
    this.innerHTML = ''
    this.dataset = {}
    this._listeners = {}
  }

  addEventListener(event, handler) {
    this._listeners[event] = handler
  }

  async trigger(event) {
    if (this._listeners[event]) {
      return await this._listeners[event]()
    }
    return undefined
  }

  async click() {
    if (this._listeners.click) {
      return await this._listeners.click()
    }
    return undefined
  }

  appendChild() {}

  querySelector() {
    return null
  }
}

class TestDocument {
  constructor(elements) {
    this._elements = elements
    this._listeners = {}
  }

  addEventListener(event, handler) {
    this._listeners[event] = handler
  }

  getElementById(id) {
    return this._elements[id] || null
  }

  createElement() {
    return new TestElement()
  }

  trigger(event) {
    if (this._listeners[event]) {
      this._listeners[event]()
    }
  }
}

const flushPromises = () => new Promise((resolve) => setImmediate(resolve))

const loadRenderer = () => {
  const rendererPath = path.join(__dirname, '..', 'src', 'settings-renderer.js')
  const resolvedRendererPath = require.resolve(rendererPath)
  delete require.cache[resolvedRendererPath]
  require(resolvedRendererPath)
}

const createJiminy = (overrides = {}) => ({
  platform: 'darwin',
  getSettings: async () => ({
    contextFolderPath: '',
    llmProviderName: 'gemini',
    llmProviderApiKey: '',
    exclusions: []
  }),
  pickContextFolder: async () => ({ canceled: true }),
  saveSettings: async () => ({ ok: true }),
  getContextGraphStatus: async () => ({ syncedNodes: 0, totalNodes: 0, maxNodesExceeded: false }),
  syncContextGraph: async () => ({ ok: true, warnings: [], errors: [] }),
  pruneContextGraph: async () => ({ ok: true, deleted: false }),
  ...overrides
})

const createElements = () => ({
  'advanced-toggle-btn': new TestElement(),
  'advanced-options': new TestElement(),
  'add-exclusion': new TestElement(),
  'capture-hotkey': new TestElement(),
  'clipboard-hotkey': new TestElement(),
  'context-folder-path': new TestElement(),
  'context-folder-choose': new TestElement(),
  'context-folder-error': new TestElement(),
  'context-folder-status': new TestElement(),
  'llm-api-key': new TestElement(),
  'llm-api-key-save': new TestElement(),
  'llm-api-key-error': new TestElement(),
  'llm-api-key-status': new TestElement(),
  'llm-provider': new TestElement(),
  'llm-provider-error': new TestElement(),
  'context-graph-sync': new TestElement(),
  'context-graph-status': new TestElement(),
  'context-graph-progress': new TestElement(),
  'context-graph-warning': new TestElement(),
  'context-graph-error': new TestElement(),
  'context-graph-prune': new TestElement(),
  'context-graph-prune-status': new TestElement(),
  'exclusions-list': new TestElement(),
  'exclusions-error': new TestElement(),
  'hotkeys-save': new TestElement(),
  'hotkeys-reset': new TestElement(),
  'hotkeys-status': new TestElement(),
  'hotkeys-error': new TestElement()
})

test('refreshes context graph status when context path changes', async () => {
  const statusCalls = []
  const saveCalls = []
  const jiminy = {
    getSettings: async () => ({
      contextFolderPath: '',
      llmProviderName: 'gemini',
      llmProviderApiKey: '',
      exclusions: []
    }),
    pickContextFolder: async () => ({ canceled: false, path: '/tmp/new-context' }),
    saveSettings: async (payload) => {
      saveCalls.push(payload)
      return { ok: true }
    },
    getContextGraphStatus: async (payload) => {
      statusCalls.push(payload)
      return { syncedNodes: 0, totalNodes: 2, maxNodesExceeded: false }
    },
    syncContextGraph: async () => ({ ok: true, warnings: [], errors: [] })
  }

  const elements = createElements()
  const document = new TestDocument(elements)
  const priorDocument = global.document
  const priorWindow = global.window
  global.document = document
  global.window = { jiminy }

  try {
    const rendererPath = path.join(__dirname, '..', 'src', 'settings-renderer.js')
    const resolvedRendererPath = require.resolve(rendererPath)
    delete require.cache[resolvedRendererPath]
    require(resolvedRendererPath)

    document.trigger('DOMContentLoaded')
    await flushPromises()
    assert.equal(statusCalls.length, 1)
    assert.equal(statusCalls[0].contextFolderPath, '')

    await elements['context-folder-choose'].click()
    await flushPromises()
    assert.equal(saveCalls.length, 1)
    assert.equal(saveCalls[0].contextFolderPath, '/tmp/new-context')
    assert.equal(elements['context-folder-status'].textContent, 'Saved.')
    assert.equal(statusCalls.length, 2)
    assert.equal(statusCalls[1].contextFolderPath, '/tmp/new-context')
  } finally {
    global.document = priorDocument
    global.window = priorWindow
  }
})

test('hotkey recording surfaces suspend errors', async () => {
  const jiminy = createJiminy({
    suspendHotkeys: async () => {
      throw new Error('suspend failed')
    }
  })

  const elements = createElements()
  const document = new TestDocument(elements)
  const priorDocument = global.document
  const priorWindow = global.window
  global.document = document
  global.window = { jiminy }

  try {
    loadRenderer()
    document.trigger('DOMContentLoaded')
    await flushPromises()

    await elements['capture-hotkey'].click()
    await flushPromises()

    assert.equal(
      elements['hotkeys-error'].textContent,
      'Failed to suspend hotkeys. Try again or restart the app.'
    )
  } finally {
    global.document = priorDocument
    global.window = priorWindow
  }
})

test('hotkey recording surfaces resume errors', async () => {
  const jiminy = createJiminy({
    suspendHotkeys: async () => {},
    resumeHotkeys: async () => {
      throw new Error('resume failed')
    }
  })

  const elements = createElements()
  const document = new TestDocument(elements)
  const priorDocument = global.document
  const priorWindow = global.window
  global.document = document
  global.window = { jiminy }

  try {
    loadRenderer()
    document.trigger('DOMContentLoaded')
    await flushPromises()

    await elements['capture-hotkey'].click()
    await flushPromises()

    const keydown = elements['capture-hotkey']._listeners.keydown
    await keydown({
      metaKey: true,
      key: 'K',
      preventDefault: () => {},
      stopPropagation: () => {}
    })
    await flushPromises()

    assert.equal(elements['hotkeys-error'].textContent, 'Failed to resume hotkeys. Restart the app.')
  } finally {
    global.document = priorDocument
    global.window = priorWindow
  }
})

test('add exclusion surfaces missing context folder errors', async () => {
  const jiminy = createJiminy({
    pickExclusion: async () => ({ canceled: true })
  })

  const elements = createElements()
  const document = new TestDocument(elements)
  const priorDocument = global.document
  const priorWindow = global.window
  global.document = document
  global.window = { jiminy }

  try {
    loadRenderer()
    document.trigger('DOMContentLoaded')
    await flushPromises()

    await elements['add-exclusion'].click()
    await flushPromises()

    assert.equal(
      elements['exclusions-error'].textContent,
      'Select a context folder before adding exclusions.'
    )
  } finally {
    global.document = priorDocument
    global.window = priorWindow
  }
})

test('add exclusion surfaces missing picker errors', async () => {
  const jiminy = createJiminy()

  const elements = createElements()
  elements['context-folder-path'].value = '/tmp/context'
  const document = new TestDocument(elements)
  const priorDocument = global.document
  const priorWindow = global.window
  global.document = document
  global.window = { jiminy }

  try {
    loadRenderer()
    document.trigger('DOMContentLoaded')
    await flushPromises()

    await elements['add-exclusion'].click()
    await flushPromises()

    assert.equal(
      elements['exclusions-error'].textContent,
      'Exclusion picker unavailable. Restart the app.'
    )
  } finally {
    global.document = priorDocument
    global.window = priorWindow
  }
})

test('add exclusion surfaces picker errors', async () => {
  const jiminy = createJiminy({
    getSettings: async () => ({
      contextFolderPath: '/tmp/context',
      llmProviderName: 'gemini',
      llmProviderApiKey: '',
      exclusions: []
    }),
    pickExclusion: async () => ({ canceled: true, error: 'boom' })
  })

  const elements = createElements()
  const document = new TestDocument(elements)
  const priorDocument = global.document
  const priorWindow = global.window
  global.document = document
  global.window = { jiminy }

  try {
    loadRenderer()
    document.trigger('DOMContentLoaded')
    await flushPromises()

    await elements['add-exclusion'].click()
    await flushPromises()

    assert.equal(elements['exclusions-error'].textContent, 'boom')
  } finally {
    global.document = priorDocument
    global.window = priorWindow
  }
})

test('exclusion save failures surface to the user', async () => {
  const jiminy = createJiminy({
    getSettings: async () => ({
      contextFolderPath: '/tmp/context',
      llmProviderName: 'gemini',
      llmProviderApiKey: '',
      exclusions: []
    }),
    pickExclusion: async () => ({ canceled: false, path: 'foo/bar' }),
    saveSettings: async () => {
      throw new Error('save failed')
    }
  })

  const elements = createElements()
  const document = new TestDocument(elements)
  const priorDocument = global.document
  const priorWindow = global.window
  global.document = document
  global.window = { jiminy }

  try {
    loadRenderer()
    document.trigger('DOMContentLoaded')
    await flushPromises()

    await elements['add-exclusion'].click()
    await flushPromises()

    assert.equal(elements['exclusions-error'].textContent, 'Failed to save exclusions.')
  } finally {
    global.document = priorDocument
    global.window = priorWindow
  }
})

test('prune button clears context graph data', async () => {
  const statusCalls = []
  const pruneCalls = []
  const jiminy = {
    getSettings: async () => ({
      contextFolderPath: '/tmp/context',
      llmProviderName: 'gemini',
      llmProviderApiKey: '',
      exclusions: []
    }),
    pickContextFolder: async () => ({ canceled: true }),
    saveSettings: async () => ({ ok: true }),
    getContextGraphStatus: async (payload) => {
      statusCalls.push(payload)
      return { syncedNodes: 1, totalNodes: 1, maxNodesExceeded: false }
    },
    syncContextGraph: async () => ({ ok: true, warnings: [], errors: [] }),
    pruneContextGraph: async () => {
      pruneCalls.push(true)
      return { ok: true, deleted: true }
    }
  }

  const elements = createElements()
  const document = new TestDocument(elements)
  const priorDocument = global.document
  const priorWindow = global.window
  global.document = document
  global.window = { jiminy }

  try {
    const rendererPath = path.join(__dirname, '..', 'src', 'settings-renderer.js')
    const resolvedRendererPath = require.resolve(rendererPath)
    delete require.cache[resolvedRendererPath]
    require(resolvedRendererPath)

    document.trigger('DOMContentLoaded')
    await flushPromises()

    assert.equal(elements['context-graph-prune'].disabled, false)
    assert.equal(statusCalls.length, 1)

    await elements['context-graph-prune'].click()
    await flushPromises()

    assert.equal(pruneCalls.length, 1)
    assert.equal(elements['context-graph-prune-status'].textContent, 'Pruned.')
    assert.equal(statusCalls.length, 2)
  } finally {
    global.document = priorDocument
    global.window = priorWindow
  }
})

test('prune button reports nothing to prune when graph is missing', async () => {
  const statusCalls = []
  const pruneCalls = []
  const jiminy = {
    getSettings: async () => ({
      contextFolderPath: '/tmp/context',
      llmProviderName: 'gemini',
      llmProviderApiKey: '',
      exclusions: []
    }),
    pickContextFolder: async () => ({ canceled: true }),
    saveSettings: async () => ({ ok: true }),
    getContextGraphStatus: async (payload) => {
      statusCalls.push(payload)
      return { syncedNodes: 0, totalNodes: 0, maxNodesExceeded: false }
    },
    syncContextGraph: async () => ({ ok: true, warnings: [], errors: [] }),
    pruneContextGraph: async () => {
      pruneCalls.push(true)
      return { ok: true, deleted: false }
    }
  }

  const elements = createElements()
  const document = new TestDocument(elements)
  const priorDocument = global.document
  const priorWindow = global.window
  global.document = document
  global.window = { jiminy }

  try {
    const rendererPath = path.join(__dirname, '..', 'src', 'settings-renderer.js')
    const resolvedRendererPath = require.resolve(rendererPath)
    delete require.cache[resolvedRendererPath]
    require(resolvedRendererPath)

    document.trigger('DOMContentLoaded')
    await flushPromises()

    assert.equal(elements['context-graph-prune'].disabled, false)
    assert.equal(statusCalls.length, 1)

    await elements['context-graph-prune'].click()
    await flushPromises()

    assert.equal(pruneCalls.length, 1)
    assert.equal(elements['context-graph-prune-status'].textContent, 'Nothing to prune.')
    assert.equal(statusCalls.length, 2)
  } finally {
    global.document = priorDocument
    global.window = priorWindow
  }
})

test('auto-saves LLM provider selection', async () => {
  const saveCalls = []
  const jiminy = {
    getSettings: async () => ({
      contextFolderPath: '',
      llmProviderName: 'gemini',
      llmProviderApiKey: '',
      exclusions: []
    }),
    pickContextFolder: async () => ({ canceled: true }),
    saveSettings: async (payload) => {
      saveCalls.push(payload)
      return { ok: true }
    },
    getContextGraphStatus: async () => ({ syncedNodes: 0, totalNodes: 0, maxNodesExceeded: false })
  }

  const elements = createElements()
  const document = new TestDocument(elements)
  const priorDocument = global.document
  const priorWindow = global.window
  global.document = document
  global.window = { jiminy }

  try {
    const rendererPath = path.join(__dirname, '..', 'src', 'settings-renderer.js')
    const resolvedRendererPath = require.resolve(rendererPath)
    delete require.cache[resolvedRendererPath]
    require(resolvedRendererPath)

    document.trigger('DOMContentLoaded')
    await flushPromises()

    elements['llm-provider'].value = 'openai'
    await elements['llm-provider'].trigger('change')
    await flushPromises()

    assert.equal(saveCalls.length, 1)
    assert.deepEqual(saveCalls[0], { llmProviderName: 'openai' })
  } finally {
    global.document = priorDocument
    global.window = priorWindow
  }
})
