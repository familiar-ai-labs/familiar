const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('jiminy', {
  platform: process.platform,
  electronVersion: process.versions.electron,
  nodeVersion: process.versions.node
})
