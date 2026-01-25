function buildTrayMenuTemplate ({
  onCapture,
  onClipboard,
  onOpenSettings,
  onAbout,
  onRestart,
  onQuit,
  captureAccelerator,
  clipboardAccelerator
}) {
  const captureItem = { label: 'Capture Selection', click: onCapture }
  if (typeof captureAccelerator === 'string' && captureAccelerator) {
    captureItem.accelerator = captureAccelerator
  }

  const clipboardItem = { label: 'Capture Clipboard', click: onClipboard }
  if (typeof clipboardAccelerator === 'string' && clipboardAccelerator) {
    clipboardItem.accelerator = clipboardAccelerator
  }

  return [
    captureItem,
    clipboardItem,
    { label: 'Open Settings', click: onOpenSettings },
    { label: 'About', click: onAbout },
    { type: 'separator' },
    { label: 'Restart', click: onRestart },
    { label: 'Quit', click: onQuit }
  ]
}

module.exports = { buildTrayMenuTemplate }
