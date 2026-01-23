const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')

const { ExhaustedLlmProviderError } = require('../modelProviders/gemini')

const makeTempSettingsDir = async () => fs.mkdtemp(path.join(os.tmpdir(), 'jiminy-settings-'))

const resetModule = (modulePath) => {
  delete require.cache[modulePath]
}

const mockModule = (modulePath, exports) => {
  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports
  }
}

test('image extraction notifies and skips on exhausted provider', async (t) => {
  const settingsDir = await makeTempSettingsDir()
  const settingsPath = path.join(settingsDir, 'settings.json')
  await fs.writeFile(settingsPath, JSON.stringify({
    llm_provider: { api_key: 'test-key' }
  }, null, 2), 'utf-8')

  const previousSettingsDir = process.env.JIMINY_SETTINGS_DIR
  process.env.JIMINY_SETTINGS_DIR = settingsDir

  const indexPath = require.resolve('../extraction/image/index')
  const handlerPath = require.resolve('../extraction/image/handler')
  const notificationsPath = require.resolve('../notifications')

  const originalIndexModule = require.cache[indexPath]
  const originalNotificationsModule = require.cache[notificationsPath]

  let notificationCalled = false

  mockModule(indexPath, {
    DEFAULT_VISION_MODEL: 'gemini-2.0-flash',
    runImageExtraction: async () => {
      throw new ExhaustedLlmProviderError()
    }
  })

  mockModule(notificationsPath, {
    showProviderExhaustedNotification: () => {
      notificationCalled = true
      return true
    }
  })

  resetModule(handlerPath)

  try {
    const { handleImageExtractionEvent } = require('../extraction/image/handler')

    const result = await handleImageExtractionEvent({ metadata: { path: '/tmp/fake.png' } })

    assert.deepEqual(result, { skipped: true, reason: 'provider_exhausted' })
    assert.equal(notificationCalled, true)
  } finally {
    if (originalIndexModule) {
      require.cache[indexPath] = originalIndexModule
    } else {
      delete require.cache[indexPath]
    }

    if (originalNotificationsModule) {
      require.cache[notificationsPath] = originalNotificationsModule
    } else {
      delete require.cache[notificationsPath]
    }

    resetModule(handlerPath)

    if (typeof previousSettingsDir === 'undefined') {
      delete process.env.JIMINY_SETTINGS_DIR
    } else {
      process.env.JIMINY_SETTINGS_DIR = previousSettingsDir
    }
  }
})
