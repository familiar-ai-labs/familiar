const test = require('node:test')
const assert = require('node:assert/strict')

const { buildTrayMenuTemplate } = require('../menu')

test('buildTrayMenuTemplate returns the expected items', () => {
  const template = buildTrayMenuTemplate({
    onCapture: () => {},
    onClipboard: () => {},
    onOpenSettings: () => {},
    onAbout: () => {},
    onRestart: () => {},
    onQuit: () => {}
  })

  const labels = template.filter((item) => item.label).map((item) => item.label)

  assert.deepEqual(labels, ['Capture Selection', 'Capture Clipboard', 'Open Settings', 'About', 'Restart', 'Quit'])
  assert.equal(template[4].type, 'separator')
})

test('about click does not trigger open settings', () => {
  let openSettingsCalls = 0
  let aboutCalls = 0

  const template = buildTrayMenuTemplate({
    onCapture: () => {},
    onClipboard: () => {},
    onOpenSettings: () => { openSettingsCalls += 1 },
    onAbout: () => { aboutCalls += 1 },
    onRestart: () => {},
    onQuit: () => {}
  })

  const aboutItem = template.find((item) => item.label === 'About')
  assert.ok(aboutItem)

  aboutItem.click()

  assert.equal(aboutCalls, 1)
  assert.equal(openSettingsCalls, 0)
})

test('open settings click does not trigger about', () => {
  let openSettingsCalls = 0
  let aboutCalls = 0

  const template = buildTrayMenuTemplate({
    onCapture: () => {},
    onClipboard: () => {},
    onOpenSettings: () => { openSettingsCalls += 1 },
    onAbout: () => { aboutCalls += 1 },
    onRestart: () => {},
    onQuit: () => {}
  })

  const openItem = template.find((item) => item.label === 'Open Settings')
  assert.ok(openItem)

  openItem.click()

  assert.equal(openSettingsCalls, 1)
  assert.equal(aboutCalls, 0)
})

test('capture click does not trigger about or settings', () => {
  let captureCalls = 0
  let openSettingsCalls = 0
  let aboutCalls = 0

  const template = buildTrayMenuTemplate({
    onCapture: () => { captureCalls += 1 },
    onClipboard: () => {},
    onOpenSettings: () => { openSettingsCalls += 1 },
    onAbout: () => { aboutCalls += 1 },
    onRestart: () => {},
    onQuit: () => {}
  })

  const captureItem = template.find((item) => item.label === 'Capture Selection')
  assert.ok(captureItem)

  captureItem.click()

  assert.equal(captureCalls, 1)
  assert.equal(openSettingsCalls, 0)
  assert.equal(aboutCalls, 0)
})

test('clipboard click does not trigger capture or settings', () => {
  let captureCalls = 0
  let clipboardCalls = 0
  let openSettingsCalls = 0

  const template = buildTrayMenuTemplate({
    onCapture: () => { captureCalls += 1 },
    onClipboard: () => { clipboardCalls += 1 },
    onOpenSettings: () => { openSettingsCalls += 1 },
    onAbout: () => {},
    onRestart: () => {},
    onQuit: () => {}
  })

  const clipboardItem = template.find((item) => item.label === 'Capture Clipboard')
  assert.ok(clipboardItem)

  clipboardItem.click()

  assert.equal(clipboardCalls, 1)
  assert.equal(captureCalls, 0)
  assert.equal(openSettingsCalls, 0)
})
