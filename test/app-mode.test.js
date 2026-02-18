const test = require('node:test');
const assert = require('node:assert/strict');

const { APP_MODE, setAppMode } = require('../src/app-mode');

const createFakeApp = () => {
    const calls = [];
    return {
        calls,
        setActivationPolicy: (policy) => {
            calls.push({ type: 'policy', policy });
        },
        dock: {
            hide: () => {
                calls.push({ type: 'dock', value: 'hide' });
            },
            show: () => {
                calls.push({ type: 'dock', value: 'show' });
            }
        }
    };
};

test('setAppMode(background) uses accessory policy and hides dock on darwin', () => {
    const app = createFakeApp();
    const ok = setAppMode({ app, mode: APP_MODE.BACKGROUND, platform: 'darwin' });
    assert.equal(ok, true);
    assert.deepEqual(app.calls, [
        { type: 'policy', policy: 'accessory' },
        { type: 'dock', value: 'hide' }
    ]);
});

test('setAppMode(foreground) uses regular policy and shows dock on darwin', () => {
    const app = createFakeApp();
    const ok = setAppMode({ app, mode: APP_MODE.FOREGROUND, platform: 'darwin' });
    assert.equal(ok, true);
    assert.deepEqual(app.calls, [
        { type: 'policy', policy: 'regular' },
        { type: 'dock', value: 'show' }
    ]);
});

test('setAppMode no-ops on non-darwin', () => {
    const app = createFakeApp();
    assert.equal(setAppMode({ app, mode: APP_MODE.BACKGROUND, platform: 'linux' }), false);
    assert.equal(setAppMode({ app, mode: APP_MODE.FOREGROUND, platform: 'linux' }), false);
    assert.deepEqual(app.calls, []);
});

test('setAppMode returns false on unsupported mode', () => {
    const app = createFakeApp();
    assert.equal(setAppMode({ app, mode: 'invalid', platform: 'darwin' }), false);
    assert.deepEqual(app.calls, []);
});
