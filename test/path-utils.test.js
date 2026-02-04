const test = require('node:test');
const assert = require('node:assert/strict');

const { ensureHomebrewPath, DEFAULT_HOMEBREW_PATHS } = require('../src/utils/path');

test('adds missing Homebrew paths on macOS', () => {
    const env = { PATH: '/usr/bin:/bin' };
    const logs = [];
    const logger = { log: (...args) => logs.push(args) };

    const result = ensureHomebrewPath({ env, platform: 'darwin', logger });

    assert.equal(result.changed, true);
    assert.deepEqual(result.added, DEFAULT_HOMEBREW_PATHS);
    assert.equal(env.PATH, '/usr/bin:/bin:/opt/homebrew/bin:/usr/local/bin');
    assert.equal(logs.length, 1);
});

test('does nothing when Homebrew paths already present', () => {
    const env = { PATH: '/usr/bin:/bin:/opt/homebrew/bin:/usr/local/bin' };
    const logs = [];
    const logger = { log: (...args) => logs.push(args) };

    const result = ensureHomebrewPath({ env, platform: 'darwin', logger });

    assert.equal(result.changed, false);
    assert.equal(result.reason, 'already-present');
    assert.equal(env.PATH, '/usr/bin:/bin:/opt/homebrew/bin:/usr/local/bin');
    assert.equal(logs.length, 0);
});

test('initializes PATH when missing', () => {
    const env = {};
    const logs = [];
    const logger = { log: (...args) => logs.push(args) };

    const result = ensureHomebrewPath({ env, platform: 'darwin', logger, brewPaths: ['/opt/homebrew/bin'] });

    assert.equal(result.changed, true);
    assert.deepEqual(result.added, ['/opt/homebrew/bin']);
    assert.equal(env.PATH, '/opt/homebrew/bin');
    assert.equal(logs.length, 1);
});

test('does nothing on non-macOS platforms', () => {
    const env = { PATH: '/usr/bin:/bin' };
    const logs = [];
    const logger = { log: (...args) => logs.push(args) };

    const result = ensureHomebrewPath({ env, platform: 'linux', logger });

    assert.equal(result.changed, false);
    assert.equal(result.reason, 'non-darwin');
    assert.equal(env.PATH, '/usr/bin:/bin');
    assert.equal(logs.length, 0);
});
