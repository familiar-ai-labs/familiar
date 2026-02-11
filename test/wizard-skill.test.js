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

const loadWizardSkillModule = () => {
  const modulePath = path.join(__dirname, '..', 'src', 'dashboard', 'wizard-skill.js')
  const resolvedPath = require.resolve(modulePath)
  delete require.cache[resolvedPath]
  return require(modulePath)
}

const createHarness = ({ currentSkillHarness = '' } = {}) => {
  const state = { currentSkillHarness }
  const claude = new TestInput('claude')
  const codex = new TestInput('codex')
  const cursor = new TestInput('cursor')
  const skillCursorRestartNote = { classList: new ClassList() }

  const familiar = {
    getSkillInstallStatus: async () => ({ ok: true, installed: false, path: '' }),
    installSkill: async () => ({ ok: true, path: '/tmp/skills/familiar' })
  }

  const registry = loadWizardSkillModule()
  registry.createWizardSkill({
    elements: {
      skillHarnessInputs: [claude, codex, cursor],
      skillInstallButton: { disabled: false, addEventListener: () => {} },
      skillInstallPath: { classList: new ClassList(), textContent: '' },
      skillCursorRestartNote
    },
    familiar,
    getState: () => ({ currentSkillHarness: state.currentSkillHarness }),
    setSkillHarness: (harness) => {
      state.currentSkillHarness = harness
    },
    setSkillInstalled: () => {},
    setMessage: () => {},
    updateWizardUI: () => {}
  })

  return {
    claude,
    codex,
    cursor,
    skillCursorRestartNote
  }
}

test('wizard skill shows cursor restart note only for cursor harness selection', async () => {
  const priorWindow = global.window
  global.window = {}

  try {
    const { claude, codex, cursor, skillCursorRestartNote } = createHarness()

    assert.equal(skillCursorRestartNote.classList.contains('hidden'), true)

    await codex.triggerChange()
    assert.equal(skillCursorRestartNote.classList.contains('hidden'), true)

    await cursor.triggerChange()
    assert.equal(skillCursorRestartNote.classList.contains('hidden'), false)

    await claude.triggerChange()
    assert.equal(skillCursorRestartNote.classList.contains('hidden'), true)
  } finally {
    global.window = priorWindow
  }
})

test('wizard skill shows cursor restart note on init when cursor is already selected', async () => {
  const priorWindow = global.window
  global.window = {}

  try {
    const { skillCursorRestartNote } = createHarness({ currentSkillHarness: 'cursor' })
    await new Promise((resolve) => setImmediate(resolve))

    assert.equal(skillCursorRestartNote.classList.contains('hidden'), false)
  } finally {
    global.window = priorWindow
  }
})
