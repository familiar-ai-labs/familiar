const { hasOpenSettingsArg } = require('../launch-intent');

const initializeProcessOwnership = ({
    app,
    isE2E = false,
    argv = process.argv.slice(1),
    onSecondInstance,
    logger = console
} = {}) => {
    const hasOpenSettingsLaunchArg = hasOpenSettingsArg(argv);
    const isPrimaryInstance = isE2E ? true : app.requestSingleInstanceLock();

    if (!isPrimaryInstance) {
        logger.log('Another Familiar instance is already running; exiting current launch attempt.');
        app.quit();
        return { isPrimaryInstance, hasOpenSettingsLaunchArg };
    }

    app.on('second-instance', (_event, commandLine = []) => {
        const hasSecondInstanceOpenSettingsArg = hasOpenSettingsArg(commandLine);
        logger.log('Second-instance launch request received; opening settings.', {
            hasOpenSettingsArg: hasSecondInstanceOpenSettingsArg
        });
        if (typeof onSecondInstance === 'function') {
            onSecondInstance({ commandLine, hasOpenSettingsArg: hasSecondInstanceOpenSettingsArg });
        }
    });

    return { isPrimaryInstance, hasOpenSettingsLaunchArg };
};

module.exports = {
    initializeProcessOwnership
};
