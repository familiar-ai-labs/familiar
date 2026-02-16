const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

class ClassList {
  constructor() {
    this.names = new Set(['hidden'])
  }

  toggle(name, force) {
    if (force === undefined) {
      if (this.names.has(name)) {
        this.names.delete(name)
        return false
      }
      this.names.add(name)
      return true
    }

    if (force) {
      this.names.add(name)
    } else {
      this.names.delete(name)
    }
    return force
  }

  contains(name) {
    return this.names.has(name)
  }
}

class TestInput {
  constructor(value) {
    this.value = value
    this.checked = false
    this._listeners = {}
  }

  addEventListener(event, handler) {
    this._listeners[event] = handler
  }

  async triggerChange() {
    if (typeof this._listeners.change === 'function') {
      await this._listeners.change({ target: this })
    }
  }
}

const setMessage = (elements, message) => {
  const targets = Array.isArray(elements) ? elements : [elements]
  const value = message || ''
  for (const element of targets) {
    if (!element) {
      continue
    }
    element.textContent = value
    element.classList.toggle('hidden', !value)
  }
}

const loadWizardSkillModule = () => {
  const modulePath = path.join(__dirname, '..', 'src', 'dashboard', 'wizard-skill.js')
  const resolvedPath = require.resolve(modulePath)
  delete require.cache[resolvedPath]
  return require(modulePath)
}

const createHarness = ({ currentSkillHarness = '', getStatus, installResult } = {}) => {
  const state = { currentSkillHarness }
  const claude = new TestInput('claude')
  const codex = new TestInput('codex')
  const antigravity = new TestInput('antigravity')
  const cursor = new TestInput('cursor')
  const settingsCodex = new TestInput('codex')
  const settingsAntigravity = new TestInput('antigravity')
  const settingsCursor = new TestInput('cursor')
  const wizardSkillCursorRestartNote = { classList: new ClassList() }
  const settingsSkillCursorRestartNote = { classList: new ClassList() }
  const wizardSkillPath = { classList: new ClassList(), textContent: '' }
  const settingsSkillPath = { classList: new ClassList(), textContent: '' }
  const wizardSkillStatus = { classList: new ClassList(), textContent: '' }
  const settingsSkillStatus = { classList: new ClassList(), textContent: '' }

  const familiar = {
    getSkillInstallStatus: async () => {
      if (typeof getStatus === 'function') {
        return getStatus()
      }
      return { ok: true, installed: false, path: '' }
    },
    installSkill: async () => {
      if (installResult) {
        return installResult
      }
      return { ok: true, path: '/tmp/skills/familiar' }
    }
  }

  const registry = loadWizardSkillModule()
  const api = registry.createWizardSkill({
    elements: {
      skillHarnessInputs: [
        claude,
        codex,
        antigravity,
        cursor,
        settingsCodex,
        settingsAntigravity,
        settingsCursor
      ],
      skillInstallButtons: [
        { disabled: false, addEventListener: () => {} },
        { disabled: false, addEventListener: () => {} }
      ],
      skillInstallPaths: [
        wizardSkillPath,
        settingsSkillPath
      ],
      skillInstallStatuses: [
        wizardSkillStatus,
        settingsSkillStatus
      ],
      skillCursorRestartNotes: [wizardSkillCursorRestartNote, settingsSkillCursorRestartNote]
    },
    familiar,
    getState: () => ({ currentSkillHarness: state.currentSkillHarness }),
    setSkillHarness: (harness) => {
      state.currentSkillHarness = harness
    },
    setSkillInstalled: () => {},
    setMessage,
    updateWizardUI: () => {}
  })

  return {
    claude,
    codex,
    antigravity,
    cursor,
    settingsCodex,
    settingsCursor,
    wizardSkillCursorRestartNote,
    settingsSkillCursorRestartNote,
    wizardSkillPath,
    settingsSkillPath,
    wizardSkillStatus,
    settingsSkillStatus,
    api
  }
}

test('wizard skill shows cursor restart note only for cursor harness selection', async () => {
  const priorWindow = global.window
  global.window = {}

  try {
    const {
      claude,
      codex,
      antigravity,
      cursor,
      settingsCodex,
      settingsCursor,
      wizardSkillCursorRestartNote,
      settingsSkillCursorRestartNote
    } = createHarness()

    assert.equal(wizardSkillCursorRestartNote.classList.contains('hidden'), true)
    assert.equal(settingsSkillCursorRestartNote.classList.contains('hidden'), true)

    await codex.triggerChange()
    assert.equal(wizardSkillCursorRestartNote.classList.contains('hidden'), true)
    assert.equal(settingsSkillCursorRestartNote.classList.contains('hidden'), true)
    assert.equal(codex.checked, true)
    assert.equal(settingsCodex.checked, true)

    await antigravity.triggerChange()
    assert.equal(wizardSkillCursorRestartNote.classList.contains('hidden'), true)
    assert.equal(settingsSkillCursorRestartNote.classList.contains('hidden'), true)
    assert.equal(antigravity.checked, true)

    await cursor.triggerChange()
    assert.equal(wizardSkillCursorRestartNote.classList.contains('hidden'), false)
    assert.equal(settingsSkillCursorRestartNote.classList.contains('hidden'), false)
    assert.equal(codex.checked, false)
    assert.equal(settingsCodex.checked, false)
    assert.equal(cursor.checked, true)
    assert.equal(settingsCursor.checked, true)

    await claude.triggerChange()
    assert.equal(wizardSkillCursorRestartNote.classList.contains('hidden'), true)
    assert.equal(settingsSkillCursorRestartNote.classList.contains('hidden'), true)
  } finally {
    global.window = priorWindow
  }
})

test('wizard skill shows cursor restart note on init when cursor is already selected', async () => {
  const priorWindow = global.window
  global.window = {}

  try {
    const { wizardSkillCursorRestartNote, settingsSkillCursorRestartNote } = createHarness({ currentSkillHarness: 'cursor' })
    await new Promise((resolve) => setImmediate(resolve))

    assert.equal(wizardSkillCursorRestartNote.classList.contains('hidden'), false)
    assert.equal(settingsSkillCursorRestartNote.classList.contains('hidden'), false)
  } finally {
    global.window = priorWindow
  }
})

test('wizard skill shows install path until installed, then shows installed path sentence', async () => {
  const priorWindow = global.window
  global.window = {}
  let statusResult = { ok: true, installed: false, path: '/tmp/.codex/skills/familiar' }

  try {
    const { codex, wizardSkillPath, wizardSkillStatus, api } = createHarness({
      getStatus: () => statusResult
    })

    await codex.triggerChange()

    assert.equal(wizardSkillPath.textContent, 'Install path: /tmp/.codex/skills/familiar')
    assert.equal(wizardSkillPath.classList.contains('hidden'), false)
    assert.equal(wizardSkillStatus.textContent, '')
    assert.equal(wizardSkillStatus.classList.contains('hidden'), true)

    statusResult = { ok: true, installed: true, path: '/tmp/.codex/skills/familiar' }
    await api.checkInstallStatus('codex')

    assert.equal(wizardSkillPath.textContent, '')
    assert.equal(wizardSkillPath.classList.contains('hidden'), true)
    assert.equal(wizardSkillStatus.textContent, 'Installed at /tmp/.codex/skills/familiar')
    assert.equal(wizardSkillStatus.classList.contains('hidden'), false)
  } finally {
    global.window = priorWindow
  }
})
