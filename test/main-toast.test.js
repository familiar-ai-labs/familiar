const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const resetMainModule = () => {
    const mainPath = require.resolve('../src/main');
    delete require.cache[mainPath];
};

test('hotkey re-registration triggers toast warnings on failure', async () => {
    const toastCalls = [];
    const handlers = {};

    const stubElectron = {
        app: {
            quit: () => {},
            relaunch: () => {},
            exit: () => {},
            whenReady: () => ({
                then: (cb) => {
                    cb();
                    return { catch: () => {} };
                },
            }),
            on: () => {},
            disableHardwareAcceleration: () => {},
            commandLine: { appendSwitch: () => {} },
        },
        BrowserWindow: function () {},
        Menu: { buildFromTemplate: () => [] },
        Tray: function () {
            this.setToolTip = () => {};
            this.setContextMenu = () => {};
        },
        dialog: { showMessageBox: () => {} },
        nativeImage: {
            createFromPath: () => ({
                isEmpty: () => false,
                resize: () => ({}),
            }),
        },
        ipcMain: {
            handle: (channel, handler) => {
                handlers[channel] = handler;
            },
        },
    };

    const originalLoad = Module._load;
    Module._load = function (request, parent, isMain) {
        if (request === 'electron') {
            return stubElectron;
        }
        if (request === './logger') {
            return { initLogging: () => {} };
        }
        if (request === './toast') {
            return {
                showToast: (payload) => {
                    toastCalls.push(payload);
                },
            };
        }
        if (request === './hotkeys') {
            return {
                DEFAULT_CAPTURE_HOTKEY: 'Cmd+Shift+P',
                DEFAULT_CLIPBOARD_HOTKEY: 'Cmd+Shift+C',
                registerCaptureHotkey: () => ({
                    ok: false,
                    reason: 'registration-failed',
                    accelerator: 'Cmd+Shift+P',
                }),
                registerClipboardHotkey: () => ({
                    ok: false,
                    reason: 'registration-failed',
                    accelerator: 'Cmd+Shift+C',
                }),
                unregisterGlobalHotkeys: () => {},
            };
        }
        if (request === './settings') {
            return { loadSettings: () => ({}) };
        }
        if (
            request === './menu' ||
            request === './ipc' ||
            request === './screenshot/capture' ||
            request === './clipboard' ||
            request === './extraction' ||
            request === './analysis' ||
            request === './utils/window'
        ) {
            return {
                buildTrayMenuTemplate: () => [],
                registerIpcHandlers: () => {},
                registerCaptureHandlers: () => {},
                startCaptureFlow: async () => ({}),
                closeOverlayWindow: () => {},
                captureClipboard: async () => ({}),
                registerExtractionHandlers: () => {},
                registerAnalysisHandlers: () => {},
                showWindow: () => ({ shown: false, reason: 'test', focused: false }),
            };
        }

        return originalLoad.call(this, request, parent, isMain);
    };

    resetMainModule();

    try {
        require('../src/main');
        assert.equal(typeof handlers['hotkeys:reregister'], 'function');
        await handlers['hotkeys:reregister']();

        assert.equal(toastCalls.length, 2);
        assert.equal(toastCalls[0].title, 'Capture hotkey inactive');
        assert.equal(toastCalls[1].title, 'Clipboard hotkey inactive');
    } finally {
        Module._load = originalLoad;
        resetMainModule();
    }
});
