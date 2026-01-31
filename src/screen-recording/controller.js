const { validateContextFolderPath } = require('../settings');
const { createPresenceMonitor } = require('./presence');
const { createRecorder } = require('./recorder');

const STATES = Object.freeze({
  DISABLED: 'disabled',
  ARMED: 'armed',
  RECORDING: 'recording',
  IDLE_GRACE: 'idleGrace',
  STOPPING: 'stopping'
});

const createScreenRecordingController = (options = {}) => {
  const logger = options.logger || console;
  const onError = typeof options.onError === 'function' ? options.onError : () => {};
  const idleThresholdSeconds =
    typeof options.idleThresholdSeconds === 'number' ? options.idleThresholdSeconds : 60;
  const presenceMonitor = options.presenceMonitor ||
    createPresenceMonitor({ idleThresholdSeconds, logger });
  const recorder = options.recorder || createRecorder({ logger });

  let state = STATES.DISABLED;
  let settings = { enabled: false, contextFolderPath: '' };
  let started = false;
  let presenceRunning = false;
  let pendingStart = false;
  let manualPaused = false;

  const setState = (nextState, details = {}) => {
    if (state === nextState) {
      return;
    }
    logger.log('Screen recording state change', {
      from: state,
      to: nextState,
      ...details
    });
    state = nextState;
  };

  const validateContext = () => {
    if (!settings.contextFolderPath) {
      return { ok: false, message: 'Context folder path missing.' };
    }
    return validateContextFolderPath(settings.contextFolderPath);
  };

  const canRecord = () => {
    if (!settings.enabled) {
      return false;
    }
    const validation = validateContext();
    if (!validation.ok) {
      logger.warn('Screen recording disabled: invalid context folder path', {
        message: validation.message
      });
      onError({ message: validation.message, reason: 'invalid-context' });
      return false;
    }
    return true;
  };

  const ensurePresenceRunning = () => {
    if (presenceRunning) {
      return;
    }
    presenceMonitor.start();
    presenceRunning = true;
  };

  const stopPresence = () => {
    if (!presenceRunning) {
      return;
    }
    presenceMonitor.stop();
    presenceRunning = false;
  };

  const startRecording = async (source) => {
    if (!canRecord()) {
      setState(STATES.DISABLED, { reason: 'invalid-context' });
      return;
    }
    if (state === STATES.RECORDING) {
      return;
    }
    pendingStart = false;
    setState(STATES.RECORDING, { source });
    try {
      await recorder.start({ contextFolderPath: settings.contextFolderPath });
    } catch (error) {
      logger.error('Failed to start screen recording', error);
      onError({ message: error?.message || 'Failed to start screen recording.', reason: 'start-failed' });
      setState(settings.enabled ? STATES.ARMED : STATES.DISABLED, { reason: 'start-failed' });
    }
  };

  const stopRecording = async (reason) => {
    if (state !== STATES.RECORDING && state !== STATES.IDLE_GRACE) {
      return;
    }
    setState(STATES.STOPPING, { reason });
    try {
      await recorder.stop({ reason });
    } catch (error) {
      logger.error('Failed to stop screen recording', error);
      onError({ message: error?.message || 'Failed to stop screen recording.', reason: 'stop-failed' });
    }

    if (settings.enabled) {
      if (pendingStart) {
        pendingStart = false;
        await startRecording('resume');
        return;
      }
      setState(STATES.ARMED, { reason: 'stopped' });
      return;
    }

    setState(STATES.DISABLED, { reason: 'disabled' });
  };

  const handleActive = () => {
    if (!settings.enabled) {
      return;
    }
    if (manualPaused) {
      return;
    }
    if (state === STATES.STOPPING) {
      pendingStart = true;
      return;
    }
    if (state === STATES.ARMED || state === STATES.IDLE_GRACE) {
      void startRecording('active');
    }
  };

  const handleIdle = ({ idleSeconds } = {}) => {
    if (state !== STATES.RECORDING) {
      if (manualPaused) {
        manualPaused = false;
      }
      return;
    }
    if (manualPaused) {
      manualPaused = false;
    }
    setState(STATES.IDLE_GRACE, { idleSeconds });
    void stopRecording('idle');
  };

  const handleLock = () => {
    manualPaused = false;
    if (state === STATES.RECORDING || state === STATES.IDLE_GRACE) {
      void stopRecording('lock');
    }
  };

  const handleSuspend = () => {
    manualPaused = false;
    if (state === STATES.RECORDING || state === STATES.IDLE_GRACE) {
      void stopRecording('suspend');
    }
  };

  const updateSettings = ({ enabled, contextFolderPath } = {}) => {
    settings = {
      enabled: enabled === true,
      contextFolderPath: typeof contextFolderPath === 'string' ? contextFolderPath : ''
    };

    if (!settings.enabled) {
      manualPaused = false;
      stopPresence();
      if (state === STATES.RECORDING || state === STATES.IDLE_GRACE) {
        void stopRecording('disabled');
      }
      setState(STATES.DISABLED, { reason: 'disabled' });
      return;
    }

    if (!canRecord()) {
      stopPresence();
      setState(STATES.DISABLED, { reason: 'invalid-context' });
      return;
    }

    if (recorder && typeof recorder.recover === 'function') {
      recorder.recover(settings.contextFolderPath);
    }

    setState(STATES.ARMED, { reason: 'enabled' });
    ensurePresenceRunning();
  };

  const manualStart = async () => {
    if (!settings.enabled) {
      return { ok: false, message: 'Recording is disabled.' };
    }
    manualPaused = false;
    await startRecording('manual');
    return { ok: true };
  };

  const manualStop = async () => {
    if (!settings.enabled) {
      return { ok: false, message: 'Recording is disabled.' };
    }
    if (state !== STATES.RECORDING && state !== STATES.IDLE_GRACE) {
      return { ok: false, message: 'Recording is not active.' };
    }
    manualPaused = true;
    await stopRecording('manual');
    return { ok: true };
  };

  const start = () => {
    if (started) {
      return;
    }
    started = true;
    presenceMonitor.on('active', handleActive);
    presenceMonitor.on('idle', handleIdle);
    presenceMonitor.on('lock', handleLock);
    presenceMonitor.on('suspend', handleSuspend);
    presenceMonitor.on('unlock', handleActive);
    presenceMonitor.on('resume', handleActive);
  };

  const shutdown = async (reason = 'quit') => {
    stopPresence();
    pendingStart = false;
    if (state === STATES.RECORDING || state === STATES.IDLE_GRACE) {
      await recorder.stop({ reason });
    }
    setState(STATES.DISABLED, { reason });
  };

  const dispose = () => {
    stopPresence();
    presenceMonitor.off('active', handleActive);
    presenceMonitor.off('idle', handleIdle);
    presenceMonitor.off('lock', handleLock);
    presenceMonitor.off('suspend', handleSuspend);
    presenceMonitor.off('unlock', handleActive);
    presenceMonitor.off('resume', handleActive);
  };

  return {
    start,
    dispose,
    shutdown,
    manualStart,
    manualStop,
    updateSettings,
    getState: () => ({ ...settings, state, manualPaused })
  };
};

module.exports = {
  STATES,
  createScreenRecordingController
};
