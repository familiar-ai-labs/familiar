const test = require('node:test');
const assert = require('node:assert/strict');

const {
    OPEN_SETTINGS_ARG,
    hasOpenSettingsArg,
    shouldOpenSettingsOnReady
} = require('../src/launch-intent');

test('hasOpenSettingsArg returns true when launch arg is present', () => {
    assert.equal(hasOpenSettingsArg(['electron', '.', OPEN_SETTINGS_ARG]), true);
});

test('hasOpenSettingsArg returns false for unrelated args', () => {
    assert.equal(hasOpenSettingsArg(['electron', '.', '--foo']), false);
});

test('shouldOpenSettingsOnReady always opens in e2e mode', () => {
    assert.equal(
        shouldOpenSettingsOnReady({
            isE2E: true,
            platform: 'darwin',
            wasOpenedAtLogin: true,
            hasOpenSettingsLaunchArg: false
        }),
        true
    );
});

test('shouldOpenSettingsOnReady does not auto-open on non-darwin', () => {
    assert.equal(
        shouldOpenSettingsOnReady({
            isE2E: false,
            platform: 'linux',
            wasOpenedAtLogin: false,
            hasOpenSettingsLaunchArg: false
        }),
        false
    );
});

test('shouldOpenSettingsOnReady does not auto-open when launched at login', () => {
    assert.equal(
        shouldOpenSettingsOnReady({
            isE2E: false,
            platform: 'darwin',
            wasOpenedAtLogin: true,
            hasOpenSettingsLaunchArg: false
        }),
        false
    );
});

test('shouldOpenSettingsOnReady opens when open-settings arg is present', () => {
    assert.equal(
        shouldOpenSettingsOnReady({
            isE2E: false,
            platform: 'darwin',
            wasOpenedAtLogin: true,
            hasOpenSettingsLaunchArg: true
        }),
        true
    );
});

test('shouldOpenSettingsOnReady opens on regular darwin launch', () => {
    assert.equal(
        shouldOpenSettingsOnReady({
            isE2E: false,
            platform: 'darwin',
            wasOpenedAtLogin: false,
            hasOpenSettingsLaunchArg: false
        }),
        true
    );
});
