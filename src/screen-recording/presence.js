const { powerMonitor } = require('electron');
const { EventEmitter } = require('node:events');

const DEFAULT_POLL_INTERVAL_MS = 1000;

const createPresenceMonitor = (options = {}) => {
  const idleThresholdSeconds =
    typeof options.idleThresholdSeconds === 'number' ? options.idleThresholdSeconds : 60;
  const pollIntervalMs =
    typeof options.pollIntervalMs === 'number' ? options.pollIntervalMs : DEFAULT_POLL_INTERVAL_MS;
  const logger = options.logger || console;
  const emitter = new EventEmitter();
  let timer = null;
  let lastState = null;

  const emitState = (nextState, payload = {}) => {
    if (lastState === nextState) {
      return;
    }
    lastState = nextState;
    emitter.emit(nextState, payload);
  };

  const evaluateIdle = (source) => {
    let idleSeconds = 0;
    try {
      idleSeconds = powerMonitor.getSystemIdleTime();
    } catch (error) {
      logger.error('Failed to read system idle time', error);
      return;
    }
    const nextState = idleSeconds >= idleThresholdSeconds ? 'idle' : 'active';
    emitState(nextState, { idleSeconds, source });
  };

  const handleLock = () => emitter.emit('lock');
  const handleUnlock = () => {
    emitter.emit('unlock');
    evaluateIdle('unlock');
  };
  const handleSuspend = () => emitter.emit('suspend');
  const handleResume = () => {
    emitter.emit('resume');
    evaluateIdle('resume');
  };
  const handleActive = () => emitState('active', { source: 'user-did-become-active' });
  const handleResign = () => evaluateIdle('user-did-resign-active');

  const start = () => {
    if (timer) {
      return;
    }
    evaluateIdle('start');
    timer = setInterval(() => evaluateIdle('poll'), pollIntervalMs);
    if (typeof timer.unref === 'function') {
      timer.unref();
    }
    powerMonitor.on('lock-screen', handleLock);
    powerMonitor.on('unlock-screen', handleUnlock);
    powerMonitor.on('suspend', handleSuspend);
    powerMonitor.on('resume', handleResume);
    powerMonitor.on('user-did-become-active', handleActive);
    powerMonitor.on('user-did-resign-active', handleResign);
    logger.log('Presence monitor started', { idleThresholdSeconds, pollIntervalMs });
  };

  const stop = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    powerMonitor.removeListener('lock-screen', handleLock);
    powerMonitor.removeListener('unlock-screen', handleUnlock);
    powerMonitor.removeListener('suspend', handleSuspend);
    powerMonitor.removeListener('resume', handleResume);
    powerMonitor.removeListener('user-did-become-active', handleActive);
    powerMonitor.removeListener('user-did-resign-active', handleResign);
    logger.log('Presence monitor stopped');
  };

  const getState = () => ({
    state: lastState,
    idleSeconds: powerMonitor.getSystemIdleTime()
  });

  return {
    start,
    stop,
    on: (...args) => emitter.on(...args),
    off: (...args) => emitter.off(...args),
    getState
  };
};

module.exports = {
  createPresenceMonitor
};
