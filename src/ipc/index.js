const { registerSettingsHandlers } = require('./settings');
const { registerRecordingHandlers } = require('./recording');
const { registerRecordingQueryHandlers } = require('./recordingQuery');
const { registerUpdateHandlers } = require('./updates');
const { registerSkillHandlers } = require('./skills');

/**
 * Registers all IPC handlers for the main process.
 */
function registerIpcHandlers(options = {}) {
    registerSettingsHandlers({ onSettingsSaved: options.onSettingsSaved });
    registerRecordingHandlers();
    registerRecordingQueryHandlers();
    registerUpdateHandlers();
    registerSkillHandlers();
}

module.exports = {
    registerIpcHandlers,
    registerSettingsHandlers,
    registerRecordingHandlers,
    registerRecordingQueryHandlers,
    registerUpdateHandlers,
    registerSkillHandlers,
};
