const { clipboard } = require('electron')
const { getClipboardDirectory, saveClipboardToDirectory } = require('./storage')
const { enqueueAnalysis } = require('../analysis')
const { loadSettings, validateContextFolderPath } = require('../settings')
const { showNotification } = require('../notifications')

async function captureClipboard () {
  const text = clipboard.readText()

  if (!text || text.trim().length === 0) {
    console.log('Clipboard capture skipped: clipboard is empty')
    showNotification({
      title: 'Clipboard Empty',
      body: 'No text content in clipboard to capture.'
    })
    return { ok: false, reason: 'empty-clipboard' }
  }

  const settings = loadSettings()
  const contextFolderPath = settings.contextFolderPath || ''
  const validation = validateContextFolderPath(contextFolderPath)

  if (!validation.ok) {
    console.warn('Clipboard capture failed: context folder not configured', { message: validation.message })
    showNotification({
      title: 'Context Folder Required',
      body: validation.message || 'Set a Context Folder Path in Settings before capturing.'
    })
    return { ok: false, reason: 'no-context-folder', message: validation.message }
  }

  const clipboardDirectory = getClipboardDirectory(validation.path)
  if (!clipboardDirectory) {
    console.error('Clipboard capture failed: clipboard directory could not be resolved')
    showNotification({
      title: 'Capture Failed',
      body: 'Could not determine clipboard directory.'
    })
    return { ok: false, reason: 'no-clipboard-directory' }
  }

  try {
    const { path: savedPath } = await saveClipboardToDirectory(text, clipboardDirectory)
    console.log('Clipboard captured', { path: savedPath })

    void enqueueAnalysis({ result_md_path: savedPath }).catch((error) => {
      console.error('Failed to enqueue clipboard analysis', { error, savedPath })
    })

    showNotification({
      title: 'Clipboard Captured',
      body: 'Text content saved and queued for analysis.'
    })

    return { ok: true, path: savedPath }
  } catch (error) {
    console.error('Clipboard capture failed', error)
    showNotification({
      title: 'Capture Failed',
      body: 'Failed to save clipboard content. Check write permissions.'
    })
    return { ok: false, reason: 'save-failed', error }
  }
}

module.exports = {
  captureClipboard
}
