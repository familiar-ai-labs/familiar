const test = require('node:test');
const assert = require('node:assert/strict');

const { keyEventToAccelerator, formatAcceleratorForDisplay, validateAccelerator } = require('../src/hotkey-utils');

// ============================================================================
// keyEventToAccelerator tests
// ============================================================================

test('keyEventToAccelerator returns null when only modifier keys are pressed', () => {
    assert.equal(keyEventToAccelerator({ metaKey: true, key: 'Meta' }), null);
    assert.equal(keyEventToAccelerator({ ctrlKey: true, key: 'Control' }), null);
    assert.equal(keyEventToAccelerator({ altKey: true, key: 'Alt' }), null);
    assert.equal(keyEventToAccelerator({ shiftKey: true, key: 'Shift' }), null);
});

test('keyEventToAccelerator returns null when no modifiers are pressed', () => {
    assert.equal(keyEventToAccelerator({ key: 'a' }), null);
    assert.equal(keyEventToAccelerator({ key: 'Enter' }), null);
    assert.equal(keyEventToAccelerator({ key: 'F1' }), null);
});

test('keyEventToAccelerator handles Cmd/Ctrl + single letter', () => {
    assert.equal(keyEventToAccelerator({ metaKey: true, key: 'j' }), 'CommandOrControl+J');
    assert.equal(keyEventToAccelerator({ ctrlKey: true, key: 's' }), 'CommandOrControl+S');
});

test('keyEventToAccelerator handles Cmd/Ctrl + Shift + letter', () => {
    assert.equal(keyEventToAccelerator({ metaKey: true, shiftKey: true, key: 'j' }), 'CommandOrControl+Shift+J');
    assert.equal(keyEventToAccelerator({ ctrlKey: true, shiftKey: true, key: 'p' }), 'CommandOrControl+Shift+P');
});

test('keyEventToAccelerator handles Alt + letter', () => {
    assert.equal(keyEventToAccelerator({ altKey: true, key: 'x' }), 'Alt+X');
});

test('keyEventToAccelerator handles Cmd/Ctrl + Alt + letter', () => {
    assert.equal(keyEventToAccelerator({ metaKey: true, altKey: true, key: 'c' }), 'CommandOrControl+Alt+C');
    assert.equal(keyEventToAccelerator({ ctrlKey: true, altKey: true, key: 'j' }), 'CommandOrControl+Alt+J');
});

test('keyEventToAccelerator falls back to event.code for non-ASCII option combos', () => {
    assert.equal(
        keyEventToAccelerator({ altKey: true, key: '≈', code: 'KeyX' }),
        'Alt+X'
    );
    assert.equal(
        keyEventToAccelerator({ metaKey: true, altKey: true, key: 'ø', code: 'KeyO' }),
        'CommandOrControl+Alt+O'
    );
});

test('keyEventToAccelerator handles all modifiers combined', () => {
    assert.equal(
        keyEventToAccelerator({ metaKey: true, altKey: true, shiftKey: true, key: 'z' }),
        'CommandOrControl+Alt+Shift+Z'
    );
});

test('keyEventToAccelerator handles function keys', () => {
    assert.equal(keyEventToAccelerator({ metaKey: true, key: 'F1' }), 'CommandOrControl+F1');
    assert.equal(keyEventToAccelerator({ altKey: true, key: 'F12' }), 'Alt+F12');
    assert.equal(keyEventToAccelerator({ shiftKey: true, key: 'F5' }), 'Shift+F5');
});

test('keyEventToAccelerator handles space key', () => {
    assert.equal(keyEventToAccelerator({ metaKey: true, key: ' ' }), 'CommandOrControl+Space');
    assert.equal(keyEventToAccelerator({ ctrlKey: true, shiftKey: true, key: ' ' }), 'CommandOrControl+Shift+Space');
});

test('keyEventToAccelerator handles arrow keys', () => {
    assert.equal(keyEventToAccelerator({ metaKey: true, key: 'ArrowUp' }), 'CommandOrControl+Up');
    assert.equal(keyEventToAccelerator({ altKey: true, key: 'ArrowDown' }), 'Alt+Down');
    assert.equal(keyEventToAccelerator({ shiftKey: true, key: 'ArrowLeft' }), 'Shift+Left');
    assert.equal(keyEventToAccelerator({ ctrlKey: true, key: 'ArrowRight' }), 'CommandOrControl+Right');
});

test('keyEventToAccelerator handles special keys', () => {
    assert.equal(keyEventToAccelerator({ metaKey: true, key: 'Escape' }), 'CommandOrControl+Escape');
    assert.equal(keyEventToAccelerator({ ctrlKey: true, key: 'Enter' }), 'CommandOrControl+Return');
    assert.equal(keyEventToAccelerator({ altKey: true, key: 'Backspace' }), 'Alt+Backspace');
    assert.equal(keyEventToAccelerator({ shiftKey: true, key: 'Delete' }), 'Shift+Delete');
    assert.equal(keyEventToAccelerator({ metaKey: true, key: 'Tab' }), 'CommandOrControl+Tab');
});

test('keyEventToAccelerator handles navigation keys', () => {
    assert.equal(keyEventToAccelerator({ metaKey: true, key: 'Home' }), 'CommandOrControl+Home');
    assert.equal(keyEventToAccelerator({ ctrlKey: true, key: 'End' }), 'CommandOrControl+End');
    assert.equal(keyEventToAccelerator({ altKey: true, key: 'PageUp' }), 'Alt+PageUp');
    assert.equal(keyEventToAccelerator({ shiftKey: true, key: 'PageDown' }), 'Shift+PageDown');
});

test('keyEventToAccelerator handles numbers', () => {
    assert.equal(keyEventToAccelerator({ metaKey: true, key: '1' }), 'CommandOrControl+1');
    assert.equal(keyEventToAccelerator({ ctrlKey: true, shiftKey: true, key: '9' }), 'CommandOrControl+Shift+9');
});

test('keyEventToAccelerator returns null for unknown keys', () => {
    assert.equal(keyEventToAccelerator({ metaKey: true, key: 'AudioVolumeUp' }), null);
    assert.equal(keyEventToAccelerator({ ctrlKey: true, key: 'Unidentified' }), null);
});

test('keyEventToAccelerator uppercases single character keys', () => {
    assert.equal(keyEventToAccelerator({ metaKey: true, key: 'a' }), 'CommandOrControl+A');
    assert.equal(keyEventToAccelerator({ metaKey: true, key: 'A' }), 'CommandOrControl+A');
});

// ============================================================================
// formatAcceleratorForDisplay tests
// ============================================================================

test('formatAcceleratorForDisplay returns placeholder for empty input', () => {
    assert.equal(formatAcceleratorForDisplay(''), 'Click to set...');
    assert.equal(formatAcceleratorForDisplay(null), 'Click to set...');
    assert.equal(formatAcceleratorForDisplay(undefined), 'Click to set...');
});

test('formatAcceleratorForDisplay uses Mac symbols on darwin', () => {
    assert.equal(formatAcceleratorForDisplay('CommandOrControl+Shift+J', 'darwin'), '⌘ + ⇧ + J');
    assert.equal(formatAcceleratorForDisplay('Alt+X', 'darwin'), '⌥ + X');
    assert.equal(formatAcceleratorForDisplay('Command+C', 'darwin'), '⌘ + C');
});

test('formatAcceleratorForDisplay uses text labels on non-Mac platforms', () => {
    assert.equal(formatAcceleratorForDisplay('CommandOrControl+Shift+J', 'win32'), 'Ctrl + Shift + J');
    assert.equal(formatAcceleratorForDisplay('Alt+X', 'linux'), 'Alt + X');
    assert.equal(formatAcceleratorForDisplay('Control+C', 'win32'), 'Ctrl + C');
});

test('formatAcceleratorForDisplay handles complex combinations', () => {
    assert.equal(formatAcceleratorForDisplay('CommandOrControl+Alt+Shift+F5', 'darwin'), '⌘ + ⌥ + ⇧ + F5');
    assert.equal(formatAcceleratorForDisplay('CommandOrControl+Alt+Shift+F5', 'win32'), 'Ctrl + Alt + Shift + F5');
});

// ============================================================================
// validateAccelerator tests
// ============================================================================

test('validateAccelerator rejects empty input', () => {
    assert.deepEqual(validateAccelerator(''), { valid: false, reason: 'empty' });
    assert.deepEqual(validateAccelerator(null), { valid: false, reason: 'empty' });
    assert.deepEqual(validateAccelerator(undefined), { valid: false, reason: 'empty' });
});

test('validateAccelerator rejects single keys without modifiers', () => {
    assert.deepEqual(validateAccelerator('J'), { valid: false, reason: 'no-modifier' });
    assert.deepEqual(validateAccelerator('F1'), { valid: false, reason: 'no-modifier' });
});

test('validateAccelerator accepts valid accelerators', () => {
    assert.deepEqual(validateAccelerator('CommandOrControl+J'), { valid: true });
    assert.deepEqual(validateAccelerator('Alt+Shift+X'), { valid: true });
    assert.deepEqual(validateAccelerator('Ctrl+F5'), { valid: true });
    assert.deepEqual(validateAccelerator('Meta+Space'), { valid: true });
});

test('validateAccelerator accepts various modifier formats', () => {
    assert.deepEqual(validateAccelerator('Command+C'), { valid: true });
    assert.deepEqual(validateAccelerator('Control+V'), { valid: true });
    assert.deepEqual(validateAccelerator('Super+L'), { valid: true });
});
