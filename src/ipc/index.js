const { registerSettingsHandlers } = require('./settings');
const { registerContextGraphHandlers, computeSyncStats, parseMaxNodesError } = require('./contextGraph');
const { registerHistoryHandlers } = require('./history');
const { registerUpdateHandlers } = require('./updates');

/**
 * Registers all IPC handlers for the main process.
 */
function registerIpcHandlers() {
    registerSettingsHandlers();
    registerContextGraphHandlers();
    registerHistoryHandlers();
    registerUpdateHandlers();
}

module.exports = {
    registerIpcHandlers,
    registerSettingsHandlers,
    registerContextGraphHandlers,
    registerHistoryHandlers,
    registerUpdateHandlers,
    computeSyncStats,
    parseMaxNodesError,
};
