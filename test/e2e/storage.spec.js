const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { test, expect } = require('playwright/test')
const { _electron: electron } = require('playwright')

const toCaptureTimestamp = (date) => date.toISOString().replace(/[:.]/g, '-')

const createCaptureFile = (dirPath, date, extension, content = '') => {
  const fileName = `${toCaptureTimestamp(date)}.${extension}`
  const fullPath = path.join(dirPath, fileName)
  fs.writeFileSync(fullPath, content || fileName, 'utf-8')
  return { fileName, fullPath }
}

const createClipboardMirrorFile = (dirPath, date, content = '') => {
  const fileName = `${toCaptureTimestamp(date)}.clipboard.txt`
  const fullPath = path.join(dirPath, fileName)
  fs.writeFileSync(fullPath, content || fileName, 'utf-8')
  return { fileName, fullPath }
}

test('delete files with 15 minute window removes only recent stills and stills-markdown files', async () => {
  const appRoot = path.join(__dirname, '../..')
  const contextPath = fs.mkdtempSync(path.join(os.tmpdir(), 'familiar-context-storage-e2e-'))
  const settingsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'familiar-settings-storage-e2e-'))

  const oldStillsSessionDir = path.join(
    contextPath,
    'familiar',
    'stills',
    'session-2026-02-17T11-00-00-000Z'
  )
  const newestStillsSessionDir = path.join(
    contextPath,
    'familiar',
    'stills',
    'session-2026-02-17T12-00-00-000Z'
  )
  const oldMarkdownSessionDir = path.join(
    contextPath,
    'familiar',
    'stills-markdown',
    'session-2026-02-17T11-00-00-000Z'
  )
  const newestMarkdownSessionDir = path.join(
    contextPath,
    'familiar',
    'stills-markdown',
    'session-2026-02-17T12-00-00-000Z'
  )
  fs.mkdirSync(oldStillsSessionDir, { recursive: true })
  fs.mkdirSync(newestStillsSessionDir, { recursive: true })
  fs.mkdirSync(oldMarkdownSessionDir, { recursive: true })
  fs.mkdirSync(newestMarkdownSessionDir, { recursive: true })

  const now = new Date()
  const oldDate = new Date(now.getTime() - 40 * 60 * 1000)
  const recentDate = new Date(now.getTime() - 10 * 60 * 1000)

  const oldStill = createCaptureFile(newestStillsSessionDir, oldDate, 'webp', 'old-still')
  const recentStill = createCaptureFile(oldStillsSessionDir, recentDate, 'webp', 'recent-still')
  const oldMarkdown = createCaptureFile(newestMarkdownSessionDir, oldDate, 'md', 'old-markdown')
  const recentMarkdown = createCaptureFile(oldMarkdownSessionDir, recentDate, 'md', 'recent-markdown')
  const oldClipboard = createClipboardMirrorFile(newestMarkdownSessionDir, oldDate, 'old-clipboard')
  const recentClipboard = createClipboardMirrorFile(
    oldMarkdownSessionDir,
    recentDate,
    'recent-clipboard'
  )

  fs.writeFileSync(
    path.join(settingsDir, 'settings.json'),
    JSON.stringify(
      {
        wizardCompleted: true,
        contextFolderPath: contextPath
      },
      null,
      2
    ),
    'utf-8'
  )

  const launchArgs = ['.']
  if (process.platform === 'linux') {
    launchArgs.push('--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage')
  }

  const electronApp = await electron.launch({
    args: launchArgs,
    cwd: appRoot,
    env: {
      ...process.env,
      FAMILIAR_E2E: '1',
      FAMILIAR_E2E_AUTO_CONFIRM_DELETE_FILES: '1',
      FAMILIAR_E2E_CONTEXT_PATH: contextPath,
      FAMILIAR_SETTINGS_DIR: settingsDir
    }
  })

  try {
    const window = await electronApp.firstWindow()
    await window.waitForLoadState('domcontentloaded')

    await window.getByRole('tab', { name: 'Storage' }).click()
    const deleteWindowSelect = window.locator('#storage-delete-window')
    await deleteWindowSelect.selectOption('15m')
    const deleteButton = window.locator('#storage-delete-files')
    await expect(deleteButton).toBeEnabled()
    await deleteButton.click()

    await expect(window.locator('#storage-delete-files-status')).toHaveText(
      'Deleted files from last 15 minutes'
    )

    await expect.poll(() => fs.existsSync(oldStill.fullPath)).toBe(true)
    await expect.poll(() => fs.existsSync(oldMarkdown.fullPath)).toBe(true)
    await expect.poll(() => fs.existsSync(oldClipboard.fullPath)).toBe(true)
    await expect.poll(() => fs.existsSync(recentStill.fullPath)).toBe(false)
    await expect.poll(() => fs.existsSync(recentMarkdown.fullPath)).toBe(false)
    await expect.poll(() => fs.existsSync(recentClipboard.fullPath)).toBe(false)
    await expect.poll(() => fs.existsSync(oldStillsSessionDir)).toBe(false)
    await expect.poll(() => fs.existsSync(oldMarkdownSessionDir)).toBe(false)
    await expect.poll(() => fs.existsSync(newestStillsSessionDir)).toBe(true)
    await expect.poll(() => fs.existsSync(newestMarkdownSessionDir)).toBe(true)
  } finally {
    await electronApp.close()
  }
})
