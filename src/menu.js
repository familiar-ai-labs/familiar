function buildTrayMenuTemplate ({ onCapture, onClipboard, onOpenSettings, onAbout, onRestart, onQuit }) {
  return [
    { label: 'Capture Selection', click: onCapture },
    { label: 'Capture Clipboard', click: onClipboard },
    { label: 'Open Settings', click: onOpenSettings },
    { label: 'About', click: onAbout },
    { type: 'separator' },
    { label: 'Restart', click: onRestart },
    { label: 'Quit', click: onQuit }
  ]
}

module.exports = { buildTrayMenuTemplate }
