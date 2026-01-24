const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const Module = require('node:module');

const resetRequireCache = () => {
    const capturePath = require.resolve('../src/screenshot/capture');
    delete require.cache[capturePath];
};

const stubElectron = ({ toastCalls }) => {
    const stub = {
        app: {
            getAppPath: () => '/tmp',
            getName: () => 'Jiminy',
            isPackaged: false,
            isReady: () => true,
            once: () => {},
        },
        BrowserWindow: function () {},
        desktopCapturer: {
            getSources: async () => [],
        },
        ipcMain: {
            handle: () => {},
        },
        screen: {
            getCursorScreenPoint: () => ({ x: 0, y: 0 }),
            getDisplayNearestPoint: () => ({
                id: 1,
                bounds: { x: 0, y: 0, width: 100, height: 100 },
                scaleFactor: 1,
            }),
        },
    };

    const originalLoad = Module._load;
    Module._load = function (request, parent, isMain) {
        if (request === 'electron') {
            return stub;
        }
        if (request === '../toast') {
            return {
                showToast: (payload) => {
                    toastCalls.push(payload);
                },
            };
        }

        return originalLoad.call(this, request, parent, isMain);
    };

    return {
        restore: () => {
            Module._load = originalLoad;
        },
    };
};

test('startCaptureFlow triggers toast when context folder is missing', async () => {
    const tempSettingsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jiminy-settings-'));
    const previousSettingsDir = process.env.JIMINY_SETTINGS_DIR;
    process.env.JIMINY_SETTINGS_DIR = tempSettingsDir;

    const toastCalls = [];
    const { restore } = stubElectron({ toastCalls });
    resetRequireCache();

    try {
        const capture = require('../src/screenshot/capture');
        const result = await capture.startCaptureFlow();

        assert.equal(result.ok, false);
        assert.equal(toastCalls.length, 1);
        assert.equal(toastCalls[0].title, 'Context Folder Required');
        assert.equal(toastCalls[0].type, 'warning');
    } finally {
        restore();
        resetRequireCache();
        if (typeof previousSettingsDir === 'undefined') {
            delete process.env.JIMINY_SETTINGS_DIR;
        } else {
            process.env.JIMINY_SETTINGS_DIR = previousSettingsDir;
        }
    }
});
