const { ipcMain, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const { loadSettings } = require('../settings');
const { JIMINY_BEHIND_THE_SCENES_DIR_NAME, STILLS_DIR_NAME } = require('../const');

function getStillsFolderPath(contextFolderPath) {
  return path.join(contextFolderPath, JIMINY_BEHIND_THE_SCENES_DIR_NAME, STILLS_DIR_NAME);
}

async function handleOpenStillsFolder() {
  try {
    const settings = loadSettings();
    const contextFolderPath = settings?.contextFolderPath || '';
    if (!contextFolderPath) {
      return { ok: false, message: 'Context folder is not set.' };
    }

    const stillsPath = getStillsFolderPath(contextFolderPath);

    try {
      fs.mkdirSync(stillsPath, { recursive: true });
    } catch (error) {
      console.error('Failed to ensure stills folder exists', { stillsPath, error });
      return { ok: false, message: 'Unable to create stills folder.' };
    }

    const openResult = await shell.openPath(stillsPath);
    if (openResult) {
      console.error('Failed to open stills folder', { stillsPath, error: openResult });
      return { ok: false, message: 'Failed to open stills folder.' };
    }

    console.log('Opened stills folder', { stillsPath });
    return { ok: true };
  } catch (error) {
    console.error('Failed to open stills folder', error);
    return { ok: false, message: 'Failed to open stills folder.' };
  }
}

function registerStillsHandlers() {
  ipcMain.handle('stills:openFolder', handleOpenStillsFolder);
  console.log('Stills IPC handlers registered');
}

module.exports = {
  registerStillsHandlers,
};

