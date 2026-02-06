const { registerSettingsHandlers } = require('./settings');
const { registerRecordingQueryHandlers } = require('./recordingQuery');
const { registerUpdateHandlers } = require('./updates');
const { registerSkillHandlers } = require('./skills');

/**
 * Registers all IPC handlers for the main process.
 */
function registerIpcHandlers(options = {}) {
    registerSettingsHandlers({ onSettingsSaved: options.onSettingsSaved });
    registerRecordingQueryHandlers();
    registerUpdateHandlers();
    registerSkillHandlers();
}

module.exports = {
    registerIpcHandlers,
    registerSettingsHandlers,
    registerRecordingQueryHandlers,
    registerUpdateHandlers,
    registerSkillHandlers,
};
