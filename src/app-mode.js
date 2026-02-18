const APP_MODE = Object.freeze({
    BACKGROUND: 'background',
    FOREGROUND: 'foreground'
});

const setAppMode = ({ app, mode, platform = process.platform, logger = console } = {}) => {
    if (!app || platform !== 'darwin') {
        return false;
    }

    if (mode !== APP_MODE.BACKGROUND && mode !== APP_MODE.FOREGROUND) {
        logger?.warn?.('Failed to enter app mode: unsupported mode', { mode });
        return false;
    }

    try {
        if (mode === APP_MODE.FOREGROUND) {
            app.setActivationPolicy('regular');
            app.dock?.show();
        } else {
            app.setActivationPolicy('accessory');
            app.dock?.hide();
        }
        return true;
    } catch (error) {
        logger?.warn?.('Failed to enter app mode', { mode, error });
        return false;
    }
};

module.exports = {
    APP_MODE,
    setAppMode
};
