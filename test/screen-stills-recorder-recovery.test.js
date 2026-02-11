const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const { EventEmitter } = require('node:events');

const resetRecorderModule = () => {
  const resolved = require.resolve('../src/screen-stills/recorder');
  delete require.cache[resolved];
};

test('recorder.start force-resets and retries once when renderer reports capture already in progress', async () => {
  resetRecorderModule();

  const ipcMain = new EventEmitter();
  const sendCalls = [];
  let startCalls = 0;
  let stopCalls = 0;
  let captureCalls = 0;

  function createWebContents() {
    const webContents = new EventEmitter();
    webContents.getURL = () => 'file://stills.html';
    webContents.send = (channel, payload) => {
      sendCalls.push({ channel, payload });
      if (channel === 'screen-stills:start') {
        startCalls += 1;
        process.nextTick(() => {
          if (startCalls === 1) {
            ipcMain.emit('screen-stills:status', {}, {
              requestId: payload.requestId,
              status: 'error',
              message: 'Capture already in progress.'
            });
          } else {
            ipcMain.emit('screen-stills:status', {}, {
              requestId: payload.requestId,
              status: 'started'
            });
          }
        });
      }

      if (channel === 'screen-stills:stop') {
        stopCalls += 1;
        process.nextTick(() => {
          ipcMain.emit('screen-stills:status', {}, {
            requestId: payload.requestId,
            status: 'stopped'
          });
        });
      }

      if (channel === 'screen-stills:capture') {
        captureCalls += 1;
        process.nextTick(() => {
          ipcMain.emit('screen-stills:status', {}, {
            requestId: payload.requestId,
            status: 'captured',
            filePath: payload.filePath
          });
        });
      }
    };
    return webContents;
  }

  function BrowserWindowStub() {
    this.webContents = createWebContents();
    this._destroyed = false;

    this.loadFile = () => {
      // Simulate load + renderer ready.
      process.nextTick(() => {
        this.webContents.emit('did-finish-load');
        ipcMain.emit('screen-stills:ready', { sender: this.webContents });
      });
    };

    this.on = () => {};
    this.isDestroyed = () => this._destroyed;
    this.destroy = () => {
      this._destroyed = true;
    };
  }

  const stubElectron = {
    BrowserWindow: BrowserWindowStub,
    desktopCapturer: {
      getSources: async () => [{ id: 'screen:1', display_id: '1' }]
    },
    ipcMain,
    screen: {
      getAllDisplays: () => [{ id: 1, bounds: { width: 1000, height: 800 }, scaleFactor: 1 }],
      getPrimaryDisplay: () => ({ id: 1, bounds: { width: 1000, height: 800 }, scaleFactor: 1 })
    },
    app: { getVersion: () => 'test' }
  };

  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === 'electron') {
      return stubElectron;
    }
    if (request === '../screen-capture/permissions') {
      return { isScreenRecordingPermissionGranted: () => true };
    }
    if (request === './session-store') {
      return {
        recoverIncompleteSessions: () => {},
        createSessionStore: ({ contextFolderPath }) => {
          const sessionId = 'session-test';
          return {
            sessionId,
            sessionDir: `${contextFolderPath}/familiar/stills/${sessionId}`,
            nextCaptureFile: (capturedAt) => ({ fileName: 'capture.webp', capturedAt }),
            addCapture: () => {},
            finalize: () => {}
          };
        }
      };
    }
    if (request === './stills-queue') {
      return {
        createStillsQueue: () => ({
          enqueueCapture: () => {},
          close: () => {}
        })
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    const { createRecorder } = require('../src/screen-stills/recorder');
    const logs = [];
    const logger = {
      log: (...args) => logs.push({ level: 'log', args }),
      warn: (...args) => logs.push({ level: 'warn', args }),
      error: (...args) => logs.push({ level: 'error', args })
    };

    const recorder = createRecorder({ logger, intervalSeconds: 1 });
    const result = await recorder.start({ contextFolderPath: '/tmp/familiar-test' });

    assert.equal(result.ok, true);
    assert.equal(startCalls, 2);
    assert.equal(stopCalls, 1);
    assert.equal(captureCalls, 1);

    const startAttempted = sendCalls.some((call) => call.channel === 'screen-stills:start');
    const stopAttempted = sendCalls.some((call) => call.channel === 'screen-stills:stop');
    assert.equal(startAttempted, true);
    assert.equal(stopAttempted, true);

    const warned = logs.some((entry) =>
      entry.level === 'warn' &&
      typeof entry.args?.[0] === 'string' &&
      entry.args[0].includes('Capture already in progress on start')
    );
    assert.equal(warned, true);

    await recorder.stop({ reason: 'test' });
    assert.equal(stopCalls, 2);
  } finally {
    Module._load = originalLoad;
    resetRecorderModule();
  }
});

test('recorder.start recreates the capture window when force-stop fails, then retries start successfully', async () => {
  resetRecorderModule();

  const ipcMain = new EventEmitter();
  const sendCalls = [];
  let startCalls = 0;
  let stopCalls = 0;
  let captureCalls = 0;
  let windowCreateCount = 0;
  let windowDestroyCount = 0;

  function createWebContents() {
    const webContents = new EventEmitter();
    webContents.getURL = () => 'file://stills.html';
    webContents.send = (channel, payload) => {
      sendCalls.push({ channel, payload });
      if (channel === 'screen-stills:start') {
        startCalls += 1;
        process.nextTick(() => {
          if (startCalls === 1) {
            ipcMain.emit('screen-stills:status', {}, {
              requestId: payload.requestId,
              status: 'error',
              message: 'Capture already in progress.'
            });
          } else {
            ipcMain.emit('screen-stills:status', {}, {
              requestId: payload.requestId,
              status: 'started'
            });
          }
        });
      }

      if (channel === 'screen-stills:stop') {
        stopCalls += 1;
        process.nextTick(() => {
          if (stopCalls === 1) {
            ipcMain.emit('screen-stills:status', {}, {
              requestId: payload.requestId,
              status: 'error',
              message: 'Renderer stop failed.'
            });
          } else {
            ipcMain.emit('screen-stills:status', {}, {
              requestId: payload.requestId,
              status: 'stopped'
            });
          }
        });
      }

      if (channel === 'screen-stills:capture') {
        captureCalls += 1;
        process.nextTick(() => {
          ipcMain.emit('screen-stills:status', {}, {
            requestId: payload.requestId,
            status: 'captured',
            filePath: payload.filePath
          });
        });
      }
    };
    return webContents;
  }

  function BrowserWindowStub() {
    windowCreateCount += 1;
    this.webContents = createWebContents();
    this._destroyed = false;

    this.loadFile = () => {
      process.nextTick(() => {
        this.webContents.emit('did-finish-load');
        ipcMain.emit('screen-stills:ready', { sender: this.webContents });
      });
    };

    this.on = () => {};
    this.isDestroyed = () => this._destroyed;
    this.destroy = () => {
      if (!this._destroyed) {
        windowDestroyCount += 1;
      }
      this._destroyed = true;
    };
  }

  const stubElectron = {
    BrowserWindow: BrowserWindowStub,
    desktopCapturer: {
      getSources: async () => [{ id: 'screen:1', display_id: '1' }]
    },
    ipcMain,
    screen: {
      getAllDisplays: () => [{ id: 1, bounds: { width: 1000, height: 800 }, scaleFactor: 1 }],
      getPrimaryDisplay: () => ({ id: 1, bounds: { width: 1000, height: 800 }, scaleFactor: 1 })
    },
    app: { getVersion: () => 'test' }
  };

  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === 'electron') {
      return stubElectron;
    }
    if (request === '../screen-capture/permissions') {
      return { isScreenRecordingPermissionGranted: () => true };
    }
    if (request === './session-store') {
      return {
        recoverIncompleteSessions: () => {},
        createSessionStore: ({ contextFolderPath }) => {
          const sessionId = `session-test-${Math.random().toString(16).slice(2)}`;
          return {
            sessionId,
            sessionDir: `${contextFolderPath}/familiar/stills/${sessionId}`,
            nextCaptureFile: (capturedAt) => ({ fileName: 'capture.webp', capturedAt }),
            addCapture: () => {},
            finalize: () => {}
          };
        }
      };
    }
    if (request === './stills-queue') {
      return {
        createStillsQueue: () => ({
          enqueueCapture: () => {},
          close: () => {}
        })
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    const { createRecorder } = require('../src/screen-stills/recorder');
    const logs = [];
    const logger = {
      log: (...args) => logs.push({ level: 'log', args }),
      warn: (...args) => logs.push({ level: 'warn', args }),
      error: (...args) => logs.push({ level: 'error', args })
    };

    const recorder = createRecorder({ logger, intervalSeconds: 1 });
    const result = await recorder.start({ contextFolderPath: '/tmp/familiar-test' });

    assert.equal(result.ok, true);
    assert.equal(startCalls, 2);
    assert.equal(stopCalls, 1);
    assert.equal(captureCalls, 1);

    // Stop failure should trigger window recreation.
    assert.equal(windowCreateCount, 2);
    assert.equal(windowDestroyCount, 1);

    const recreateLogged = logs.some((entry) =>
      entry.level === 'warn' &&
      typeof entry.args?.[0] === 'string' &&
      entry.args[0].includes('Destroying capture window')
    );
    assert.equal(recreateLogged, true);

    await recorder.stop({ reason: 'test' });
    assert.equal(stopCalls, 2);

    const stopAttempted = sendCalls.some((call) => call.channel === 'screen-stills:stop');
    assert.equal(stopAttempted, true);
  } finally {
    Module._load = originalLoad;
    resetRecorderModule();
  }
});
