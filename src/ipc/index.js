const { registerSettingsHandlers } = require('./settings');
const { registerHistoryHandlers } = require('./history');
const { registerRecordingQueryHandlers } = require('./recordingQuery');
const { registerUpdateHandlers } = require('./updates');

/**
 * Registers all IPC handlers for the main process.
 */
function registerIpcHandlers(options = {}) {
    registerSettingsHandlers({ onSettingsSaved: options.onSettingsSaved });
    registerHistoryHandlers();
    registerRecordingQueryHandlers();
    registerUpdateHandlers();
}

module.exports = {
    registerIpcHandlers,
    registerSettingsHandlers,
    registerHistoryHandlers,
    registerRecordingQueryHandlers,
    registerUpdateHandlers,
};
