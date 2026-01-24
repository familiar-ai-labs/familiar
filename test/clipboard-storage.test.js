const test = require('node:test')
const assert = require('node:assert/strict')
const os = require('node:os')
const path = require('node:path')
const fs = require('node:fs/promises')

const { buildClipboardFilename, getClipboardDirectory, saveClipboardToDirectory } = require('../src/clipboard/storage')
const {
  CAPTURES_DIR_NAME,
  JIMINY_BEHIND_THE_SCENES_DIR_NAME
} = require('../src/const')

test('buildClipboardFilename uses a stable timestamp format with clipboard prefix', () => {
  const date = new Date(2026, 0, 2, 3, 4, 5, 6)
  const filename = buildClipboardFilename(date)

  assert.equal(filename, 'clipboard-2026-01-02_03-04-05-006.md')
})

test('getClipboardDirectory returns a path under the context folder', () => {
  const dir = getClipboardDirectory('/tmp/context')
  assert.equal(dir, path.join('/tmp/context', JIMINY_BEHIND_THE_SCENES_DIR_NAME, CAPTURES_DIR_NAME))
})

test('getClipboardDirectory returns null without a context folder', () => {
  assert.equal(getClipboardDirectory(''), null)
  assert.equal(getClipboardDirectory(null), null)
})

test('saveClipboardToDirectory writes text to the target directory', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jiminy-clipboard-'))
  const nestedDir = path.join(tempDir, 'nested')
  const text = 'Test clipboard content\nwith multiple lines'
  const date = new Date(2026, 0, 2, 3, 4, 5, 6)

  const result = await saveClipboardToDirectory(text, nestedDir, date)

  assert.ok(result.path.startsWith(nestedDir))
  assert.ok(result.path.endsWith('.md'))
  assert.ok(result.filename.startsWith('clipboard-'))
  const content = await fs.readFile(result.path, 'utf-8')
  assert.equal(content, text)
})

test('saveClipboardToDirectory stores clipboard under the context captures folder', async () => {
  const contextDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jiminy-context-clipboard-'))
  const clipboardDir = getClipboardDirectory(contextDir)
  const text = 'Clipboard content for context folder test'
  const date = new Date(2026, 0, 2, 3, 4, 5, 6)

  const result = await saveClipboardToDirectory(text, clipboardDir, date)

  assert.equal(path.dirname(result.path), clipboardDir)
})

test('saveClipboardToDirectory throws on invalid text', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jiminy-clipboard-invalid-'))

  await assert.rejects(
    saveClipboardToDirectory(null, tempDir),
    { message: 'Clipboard text is missing or invalid.' }
  )

  await assert.rejects(
    saveClipboardToDirectory(undefined, tempDir),
    { message: 'Clipboard text is missing or invalid.' }
  )
})

test('saveClipboardToDirectory throws on missing directory', async () => {
  await assert.rejects(
    saveClipboardToDirectory('test content', null),
    { message: 'Clipboard directory is missing.' }
  )

  await assert.rejects(
    saveClipboardToDirectory('test content', ''),
    { message: 'Clipboard directory is missing.' }
  )
})
