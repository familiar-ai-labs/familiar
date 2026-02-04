const test = require('node:test')
const assert = require('node:assert/strict')

const { createTrayMenuController } = require('../src/tray/refresh')

test('tray refreshes history items on click', async () => {
  const historyCalls = []
  const capturedHistoryItems = []
  const historyResponses = [
    [{ summary: 'First flow', status: 'success' }],
    [{ summary: 'Second flow', status: 'failed' }]
  ]
  let historyIndex = 0

  const trayInstance = {
    _handlers: {},
    setContextMenu: () => {},
    on(event, handler) {
      this._handlers[event] = handler
    }
  }

  const controller = createTrayMenuController({
    tray: trayInstance,
    trayHandlers: {},
    DEFAULT_CLIPBOARD_HOTKEY: 'Cmd+Shift+C',
    DEFAULT_RECORDING_HOTKEY: 'Cmd+Shift+R',
    loadSettingsFn: () => ({ contextFolderPath: '/tmp' }),
    getRecentFlowsFn: () => {
      const result = historyResponses[Math.min(historyIndex, historyResponses.length - 1)]
      historyCalls.push(result)
      historyIndex += 1
      return result
    },
    buildTrayMenuTemplateFn: (options) => {
      capturedHistoryItems.push(options.historyItems)
      return []
    },
    menu: { buildFromTemplate: (template) => template }
  })

  controller.refreshTrayMenuFromSettings()
  assert.equal(historyCalls.length, 1)
  controller.registerTrayRefreshHandlers()
  assert.equal(typeof trayInstance._handlers.click, 'function')

  trayInstance._handlers.click()

  assert.equal(historyCalls.length, 2)
  assert.equal(capturedHistoryItems[0][0].summary, 'First flow')
  assert.equal(capturedHistoryItems[1][0].summary, 'Second flow')
})
