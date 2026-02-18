const OPEN_SETTINGS_ARG = '--open-settings';

const hasOpenSettingsArg = (argv = []) =>
    Array.isArray(argv)
        && argv.some((value) => typeof value === 'string' && value.trim() === OPEN_SETTINGS_ARG);

const shouldOpenSettingsOnReady = ({
    isE2E = false,
    platform = '',
    wasOpenedAtLogin = false,
    hasOpenSettingsLaunchArg = false
} = {}) => {
    if (isE2E) {
        return true;
    }

    if (platform !== 'darwin') {
        return false;
    }

    if (hasOpenSettingsLaunchArg) {
        return true;
    }

    return wasOpenedAtLogin !== true;
};

module.exports = {
    OPEN_SETTINGS_ARG,
    hasOpenSettingsArg,
    shouldOpenSettingsOnReady
};
