// Modules to control application life and create native browser window
const { app, BrowserWindow, Menu, Tray, dialog, nativeImage } = require('electron')
const path = require('node:path')
const { buildTrayMenuTemplate } = require('./menu')
const trayIconPath = path.join(__dirname, 'icon.png')

let tray = null
let settingsWindow = null
let isQuitting = false

function createSettingsWindow () {
  const window = new BrowserWindow({
    width: 420,
    height: 320,
    resizable: false,
    fullscreenable: false,
    minimizable: false,
    show: false,
    title: 'Jiminy Settings',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  })

  window.loadFile('index.html')

  window.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      window.hide()
      console.log('Settings window hidden')
    }
  })

  window.on('closed', () => {
    settingsWindow = null
  })

  console.log('Settings window created')
  return window
}

function showSettingsWindow () {
  if (!settingsWindow) {
    settingsWindow = createSettingsWindow()
  }

  if (settingsWindow.isMinimized()) {
    settingsWindow.restore()
  }

  settingsWindow.show()
  settingsWindow.focus()
  console.log('Settings window shown')
}

function showAboutDialog () {
  dialog.showMessageBox({
    type: 'info',
    title: 'About Jiminy',
    message: 'Jiminy',
    detail: 'Menu bar app shell (macOS).',
    buttons: ['OK']
  })
}

function restartApp () {
  console.log('Restarting app')
  app.relaunch()
  app.exit(0)
}

function quitApp () {
  console.log('Quitting app')
  app.quit()
}

function createTray () {
  const trayIconBase = nativeImage.createFromPath(trayIconPath)
  if (trayIconBase.isEmpty()) {
    console.error(`Tray icon failed to load from ${trayIconPath}`)
  }

  const trayIcon = trayIconBase.resize({ width: 16, height: 16 })

  tray = new Tray(trayIcon)
  tray.setToolTip('Jiminy')

  const trayMenu = Menu.buildFromTemplate(
    buildTrayMenuTemplate({
      onOpenSettings: showSettingsWindow,
      onAbout: showAboutDialog,
      onRestart: restartApp,
      onQuit: quitApp
    })
  )

  tray.setContextMenu(trayMenu)

  console.log('Tray created')
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  if (process.platform !== 'darwin') {
    console.error('Jiminy desktop app is macOS-only right now.')
    app.quit()
    return
  }

  app.dock.hide()
  app.setLoginItemSettings({ openAtLogin: true, openAsHidden: true })

  createTray()

  app.on('activate', () => {
    // Keep background-only behavior; open Settings only from the tray menu.
  })
})

app.on('before-quit', () => {
  isQuitting = true
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
