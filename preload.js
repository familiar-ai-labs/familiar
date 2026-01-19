const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('jiminy', {
  platform: process.platform,
  electronVersion: process.versions.electron,
  nodeVersion: process.versions.node,
  getSettings: () => ipcRenderer.invoke('settings:get'),
  pickContextFolder: () => ipcRenderer.invoke('settings:pickContextFolder'),
  saveSettings: (contextFolderPath) => ipcRenderer.invoke('settings:save', { contextFolderPath }),
  syncContextGraph: () => ipcRenderer.invoke('contextGraph:sync'),
  onContextGraphProgress: (handler) => {
    const listener = (_event, payload) => handler(payload)
    ipcRenderer.on('contextGraph:progress', listener)
    return () => ipcRenderer.removeListener('contextGraph:progress', listener)
  }
})
