const { ipcMain, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { loadSettings } = require('../settings');
const { JIMINY_BEHIND_THE_SCENES_DIR_NAME, RECORDINGS_DIR_NAME } = require('../const');

function getRecordingsFolderPath(contextFolderPath) {
    return path.join(contextFolderPath, JIMINY_BEHIND_THE_SCENES_DIR_NAME, RECORDINGS_DIR_NAME);
}

async function handleOpenRecordingFolder() {
    try {
        const settings = loadSettings();
        const contextFolderPath = settings?.contextFolderPath || '';
        if (!contextFolderPath) {
            return { ok: false, message: 'Context folder is not set.' };
        }

        const recordingsPath = getRecordingsFolderPath(contextFolderPath);

        try {
            fs.mkdirSync(recordingsPath, { recursive: true });
        } catch (error) {
            console.error('Failed to ensure recordings folder exists', { recordingsPath, error });
            return { ok: false, message: 'Unable to create recordings folder.' };
        }

        const openResult = await shell.openPath(recordingsPath);
        if (openResult) {
            console.error('Failed to open recordings folder', { recordingsPath, error: openResult });
            return { ok: false, message: 'Failed to open recordings folder.' };
        }

        console.log('Opened recordings folder', { recordingsPath });
        return { ok: true };
    } catch (error) {
        console.error('Failed to open recordings folder', error);
        return { ok: false, message: 'Failed to open recordings folder.' };
    }
}

function registerRecordingHandlers() {
    ipcMain.handle('recording:openFolder', handleOpenRecordingFolder);
    console.log('Recording IPC handlers registered');
}

module.exports = {
    registerRecordingHandlers,
};
