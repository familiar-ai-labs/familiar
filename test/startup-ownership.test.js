const test = require('node:test');
const assert = require('node:assert/strict');

const { initializeProcessOwnership } = require('../src/startup/ownership');

const createFakeApp = ({ lock = true } = {}) => {
    const events = {};
    let quitCalls = 0;

    return {
        events,
        on: (event, handler) => {
            events[event] = handler;
        },
        requestSingleInstanceLock: () => lock,
        quit: () => {
            quitCalls += 1;
        },
        getQuitCalls: () => quitCalls
    };
};

test('initializeProcessOwnership bypasses lock in E2E mode', () => {
    const app = createFakeApp({ lock: false });

    const result = initializeProcessOwnership({
        app,
        isE2E: true,
        argv: ['electron', '.']
    });

    assert.equal(result.isPrimaryInstance, true);
    assert.equal(app.getQuitCalls(), 0);
    assert.equal(typeof app.events['second-instance'], 'function');
});

test('initializeProcessOwnership quits when lock is not acquired', () => {
    const app = createFakeApp({ lock: false });

    const result = initializeProcessOwnership({
        app,
        isE2E: false,
        argv: ['electron', '.']
    });

    assert.equal(result.isPrimaryInstance, false);
    assert.equal(app.getQuitCalls(), 1);
    assert.equal(app.events['second-instance'], undefined);
});

test('initializeProcessOwnership emits second-instance callback metadata', () => {
    const app = createFakeApp({ lock: true });
    let callbackPayload = null;

    initializeProcessOwnership({
        app,
        argv: ['electron', '.', '--open-settings'],
        onSecondInstance: (payload) => {
            callbackPayload = payload;
        }
    });

    const secondInstanceHandler = app.events['second-instance'];
    assert.equal(typeof secondInstanceHandler, 'function');
    secondInstanceHandler({}, ['electron', '.', '--open-settings']);

    assert.ok(callbackPayload);
    assert.equal(callbackPayload.hasOpenSettingsArg, true);
    assert.deepEqual(callbackPayload.commandLine, ['electron', '.', '--open-settings']);
});
