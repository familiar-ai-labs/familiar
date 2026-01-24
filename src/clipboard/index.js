const { captureClipboard } = require('./capture')
const { buildClipboardFilename, getClipboardDirectory, saveClipboardToDirectory } = require('./storage')

module.exports = {
  captureClipboard,
  buildClipboardFilename,
  getClipboardDirectory,
  saveClipboardToDirectory
}
