const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { test, expect } = require('playwright/test')
const { _electron: electron } = require('playwright')

test('check for updates shows disabled message in e2e mode', async () => {
  const appRoot = path.join(__dirname, '../..')
  const contextPath = path.join(appRoot, 'test', 'fixtures', 'context')
  const settingsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jiminy-settings-e2e-'))
  const launchArgs = ['.']
  if (process.platform === 'linux' || process.env.CI) {
    launchArgs.push('--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage')
  }

  const electronApp = await electron.launch({
    args: launchArgs,
    cwd: appRoot,
    env: {
      ...process.env,
      JIMINY_E2E: '1',
      JIMINY_E2E_CONTEXT_PATH: contextPath,
      JIMINY_SETTINGS_DIR: settingsDir
    }
  })

  try {
    const window = await electronApp.firstWindow()
    await window.waitForLoadState('domcontentloaded')
    await window.getByRole('tab', { name: 'Updates' }).click()

    await window.locator('#updates-check').click()

    await expect(window.locator('#updates-error')).toHaveText('Auto-updates are disabled in this build.')
    await expect(window.locator('#updates-status')).toBeHidden()
  } finally {
    await electronApp.close()
  }
})
