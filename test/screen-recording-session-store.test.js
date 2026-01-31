const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const {
  createSessionStore,
  recoverIncompleteSessions
} = require('../src/screen-recording/session-store')

const CAPTURE_CONFIG = {
  container: 'mp4',
  codec: 'h264',
  fps: 2,
  scale: 0.5,
  audio: false
}

const readManifest = (manifestPath) =>
  JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))

const makeTempContext = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jiminy-context-'))
  fs.mkdirSync(root, { recursive: true })
  return root
}

test('session store writes manifest and segments', () => {
  const contextFolderPath = makeTempContext()
  const store = createSessionStore({
    contextFolderPath,
    captureConfig: CAPTURE_CONFIG,
    segmentLengthMs: 300000
  })

  const first = store.nextSegmentFile()
  store.addSegment({
    index: first.index,
    fileName: first.fileName,
    startedAt: '2025-01-01T00:00:00.000Z',
    endedAt: '2025-01-01T00:00:10.000Z',
    durationMs: 10000
  })
  store.finalize('idle')

  const manifest = readManifest(store.manifestPath)
  assert.equal(manifest.settings.container, 'mp4')
  assert.equal(manifest.segments.length, 1)
  assert.equal(manifest.segments[0].file, first.fileName)
  assert.equal(manifest.stopReason, 'idle')
  assert.ok(manifest.endedAt)
})

test('recoverIncompleteSessions finalizes unfinished manifests', () => {
  const contextFolderPath = makeTempContext()
  const recordingsRoot = path.join(contextFolderPath, 'jiminy', 'recordings', 'session-test')
  fs.mkdirSync(recordingsRoot, { recursive: true })

  const manifestPath = path.join(recordingsRoot, 'manifest.json')
  fs.writeFileSync(
    manifestPath,
    JSON.stringify({ version: 1, startedAt: '2025-01-01T00:00:00.000Z', segments: [] }, null, 2),
    'utf-8'
  )

  const updated = recoverIncompleteSessions(contextFolderPath)
  assert.equal(updated, 1)

  const manifest = readManifest(manifestPath)
  assert.equal(manifest.stopReason, 'crash')
  assert.ok(manifest.endedAt)
})
