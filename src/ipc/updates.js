const { ipcMain } = require('electron');
const { checkForUpdates } = require('../updates');

const registerUpdateHandlers = () => {
    ipcMain.handle('updates:check', (_event, payload = {}) => {
        const reason = payload && payload.reason ? payload.reason : 'manual';
        return checkForUpdates({ reason });
    });
};

module.exports = {
    registerUpdateHandlers,
};
