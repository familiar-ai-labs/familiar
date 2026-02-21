const test = require('node:test')
const assert = require('node:assert/strict')

const { createStorageUsage, formatBytes } = require('../src/dashboard/storage-usage')

class TestElement {
  constructor() {
    this.textContent = ''
    this.style = {}
    this.title = ''
    this.hidden = false
    this._classes = new Set()
    this.classList = {
      toggle: (name, force) => {
        const isHiddenClass = name === 'hidden'
        const shouldAdd = Boolean(force)
        if (shouldAdd) {
          this._classes.add(name)
        } else {
          this._classes.delete(name)
        }
        if (isHiddenClass) {
          this.hidden = shouldAdd
        }
      }
    }
  }
}

function setMessage(elements, message) {
  const items = Array.isArray(elements) ? elements : [elements]
  const nextValue = message || ''
  for (const element of items) {
    if (!element) {
      continue
    }
    element.textContent = nextValue
    element.classList.toggle('hidden', !nextValue)
  }
}

test('formatBytes returns readable storage text', () => {
  assert.equal(formatBytes(0), '0 B')
  assert.equal(formatBytes(1024), '1.00 KB')
  assert.equal(formatBytes(5 * 1024 * 1024), '5.00 MB')
})

test('createStorageUsage refresh renders total, legend values, and stacked widths', async () => {
  const totalLabel = new TestElement()
  const loadingContainer = new TestElement()
  const loadedContainer = new TestElement()
  const loadingIndicator = new TestElement()
  const computingTag = new TestElement()
  const screenshotsValueLabel = new TestElement()
  const steelsMarkdownValueLabel = new TestElement()
  const systemValueLabel = new TestElement()
  const screenshotsBar = new TestElement()
  const steelsMarkdownBar = new TestElement()
  const systemBar = new TestElement()
  const status = new TestElement()
  const error = new TestElement()

  const api = createStorageUsage({
    familiar: {
      getStorageUsageBreakdown: async () => ({
        ok: true,
        totalBytes: 1000,
        screenshotsBytes: 600,
        steelsMarkdownBytes: 200,
        systemBytes: 200
      })
    },
    setMessage,
    elements: {
      totalLabel,
      loadingContainer,
      loadedContainer,
      loadingIndicator,
      computingTag,
      screenshotsValueLabel,
      steelsMarkdownValueLabel,
      systemValueLabel,
      screenshotsBar,
      steelsMarkdownBar,
      systemBar,
      statusElements: [status],
      errorElements: [error]
    }
  })

  await api.refresh()

  assert.equal(totalLabel.textContent, 'Total: 1000 B')
  assert.equal(screenshotsValueLabel.textContent, '600 B')
  assert.equal(steelsMarkdownValueLabel.textContent, '200 B')
  assert.equal(systemValueLabel.textContent, '200 B')
  assert.equal(screenshotsBar.style.width, '60%')
  assert.equal(steelsMarkdownBar.style.width, '20%')
  assert.equal(systemBar.style.width, '20%')
  assert.equal(status.textContent, '')
  assert.equal(error.textContent, '')
  assert.equal(loadingContainer.hidden, true)
  assert.equal(loadedContainer.hidden, false)
  assert.equal(loadingIndicator.hidden, true)
  assert.equal(computingTag.hidden, true)
  assert.equal(totalLabel.hidden, false)
})
