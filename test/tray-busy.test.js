const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const Module = require('node:module');
const { test } = require('node:test');

const busyPath = require.resolve('../src/tray/busy');

const resetBusyModule = () => {
    delete require.cache[busyPath];
};

test('tray busy indicator starts on scheduled and stops when all sources idle', () => {
    const extractionEvents = new EventEmitter();
    const analysisEvents = new EventEmitter();
    const frames = [];

    const stubElectron = {
        nativeImage: {
            createFromBuffer: (buffer, options) => {
                const frame = { buffer, options, id: frames.length };
                frames.push(frame);
                return frame;
            },
        },
    };

    const originalLoad = Module._load;
    const originalSetInterval = global.setInterval;
    const originalClearInterval = global.clearInterval;
    let intervalCallback = null;

    global.setInterval = (callback) => {
        intervalCallback = callback;
        return 1;
    };
    global.clearInterval = () => {
        intervalCallback = null;
    };

    Module._load = function (request, parent, isMain) {
        if (request === 'electron') {
            return stubElectron;
        }
        if (request === '../extraction') {
            return { queueEvents: extractionEvents };
        }
        if (request === '../analysis') {
            return { queueEvents: analysisEvents };
        }
        return originalLoad.call(this, request, parent, isMain);
    };

    resetBusyModule();

    try {
        const { registerTrayBusyIndicator } = require('../src/tray/busy');
        const setImageCalls = [];
        const tray = {
            setImage: (image) => {
                setImageCalls.push(image);
            },
            isDestroyed: () => false,
        };
        const baseIcon = {
            isEmpty: () => false,
            getSize: () => ({ width: 16, height: 16 }),
            toBitmap: () => Buffer.alloc(16 * 16 * 4, 255),
        };

        const indicator = registerTrayBusyIndicator({ tray, baseIcon });

        extractionEvents.emit('scheduled');
        assert.ok(setImageCalls.length === 1, 'starts animation on first scheduled');
        assert.notEqual(setImageCalls[0], baseIcon);

        analysisEvents.emit('scheduled');
        assert.equal(setImageCalls.length, 1, 'does not restart when another source schedules');

        extractionEvents.emit('idle');
        assert.equal(setImageCalls.length, 1, 'remains busy while another source active');

        analysisEvents.emit('idle');
        assert.equal(setImageCalls.length, 2, 'stops when all sources idle');
        assert.equal(setImageCalls[setImageCalls.length - 1], baseIcon);

        indicator.dispose();
        assert.equal(intervalCallback, null);
    } finally {
        Module._load = originalLoad;
        global.setInterval = originalSetInterval;
        global.clearInterval = originalClearInterval;
        resetBusyModule();
    }
});
