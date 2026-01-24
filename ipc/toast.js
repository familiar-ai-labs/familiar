const { ipcMain } = require('electron');

function registerToastHandlers() {
    ipcMain.handle('toast-resize', handleToastResize);
    console.log('resizing toast');
}

function handleToastResize(_event, { height }) {
  if (!toastWindow || toastWindow.isDestroyed()) return

  // Clamp to something reasonable so a crazy long body doesn't create a giant window
  const clampedHeight = Math.max(60, Math.min(320, Math.ceil(height)))

  const [currentWidth] = toastWindow.getSize()

  // Keep pinned to top-right of the display the toast is currently on
  const display = screen.getDisplayMatching(toastWindow.getBounds())
  const { workArea } = display

  toastWindow.setBounds(
    {
      width: currentWidth,
      height: clampedHeight,
      x: workArea.x + workArea.width - currentWidth - TOAST_MARGIN,
      y: workArea.y + TOAST_MARGIN
    },
    false
  )
}