const assert = require('node:assert/strict')
const path = require('node:path')
const { test } = require('node:test')

class TestElement {
  constructor() {
    this.style = {}
    this.classList = { toggle: () => {} }
    this.hidden = false
    this.disabled = false
    this.value = ''
    this.textContent = ''
    this.title = ''
    this.innerHTML = ''
    this._listeners = {}
  }

  addEventListener(event, handler) {
    this._listeners[event] = handler
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

const createElements = () => ({
  'context-folder-path': new TestElement(),
  'context-folder-choose': new TestElement(),
  'context-folder-save': new TestElement(),
  'context-folder-error': new TestElement(),
  'context-folder-status': new TestElement(),
  'llm-api-key': new TestElement(),
  'llm-api-key-save': new TestElement(),
  'llm-api-key-error': new TestElement(),
  'llm-api-key-status': new TestElement(),
  'context-graph-sync': new TestElement(),
  'context-graph-status': new TestElement(),
  'context-graph-progress': new TestElement(),
  'context-graph-warning': new TestElement(),
  'context-graph-error': new TestElement()
})

test('refreshes context graph status when context path changes', async () => {
  const statusCalls = []
  const jiminy = {
    getSettings: async () => ({
      contextFolderPath: '',
      llmProviderApiKey: '',
      exclusions: []
    }),
    pickContextFolder: async () => ({ canceled: false, path: '/tmp/new-context' }),
    saveSettings: async () => ({ ok: true }),
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
    const rendererPath = path.join(__dirname, '..', 'settings-renderer.js')
    const resolvedRendererPath = require.resolve(rendererPath)
    delete require.cache[resolvedRendererPath]
    require(resolvedRendererPath)

    document.trigger('DOMContentLoaded')
    await flushPromises()
    assert.equal(statusCalls.length, 1)
    assert.equal(statusCalls[0].contextFolderPath, '')

    await elements['context-folder-choose'].click()
    await flushPromises()
    assert.equal(statusCalls.length, 2)
    assert.equal(statusCalls[1].contextFolderPath, '/tmp/new-context')
  } finally {
    global.document = priorDocument
    global.window = priorWindow
  }
})
