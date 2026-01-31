const fs = require('node:fs');
const path = require('node:path');

const { JIMINY_BEHIND_THE_SCENES_DIR_NAME, RECORDINGS_DIR_NAME } = require('../const');

const formatTimestamp = (date) => date.toISOString().replace(/[:.]/g, '-');
const padSegmentIndex = (index) => String(index).padStart(4, '0');

const getRecordingsRoot = (contextFolderPath) =>
  path.join(contextFolderPath, JIMINY_BEHIND_THE_SCENES_DIR_NAME, RECORDINGS_DIR_NAME);

const createSessionStore = ({ contextFolderPath, captureConfig, segmentLengthMs, logger = console } = {}) => {
  if (!contextFolderPath) {
    throw new Error('Context folder path is required to create a recording session.');
  }
  const sessionTimestamp = formatTimestamp(new Date());
  const sessionDir = path.join(getRecordingsRoot(contextFolderPath), `session-${sessionTimestamp}`);
  fs.mkdirSync(sessionDir, { recursive: true });

  const manifest = {
    version: 1,
    startedAt: new Date().toISOString(),
    endedAt: null,
    stopReason: null,
    settings: { ...captureConfig, segmentLengthMs },
    segments: []
  };

  const manifestPath = path.join(sessionDir, 'manifest.json');
  let segmentIndex = 0;

  const writeManifest = () => {
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  };

  const nextSegmentFile = () => {
    segmentIndex += 1;
    return {
      index: segmentIndex,
      fileName: `segment-${padSegmentIndex(segmentIndex)}.${captureConfig.container}`
    };
  };

  const addSegment = ({ index, fileName, startedAt, endedAt, durationMs }) => {
    manifest.segments.push({
      index,
      file: fileName,
      startedAt,
      endedAt,
      durationMs
    });
    writeManifest();
  };

  const finalize = (stopReason) => {
    manifest.endedAt = new Date().toISOString();
    manifest.stopReason = stopReason || 'stop';
    writeManifest();
  };

  writeManifest();
  logger.log('Recording manifest created', { manifestPath });

  return {
    sessionDir,
    manifestPath,
    manifest,
    nextSegmentFile,
    addSegment,
    finalize
  };
};

const recoverIncompleteSessions = (contextFolderPath, logger = console) => {
  const recordingsRoot = getRecordingsRoot(contextFolderPath);
  if (!fs.existsSync(recordingsRoot)) {
    return 0;
  }

  const entries = fs.readdirSync(recordingsRoot, { withFileTypes: true });
  let updatedCount = 0;

  entries.filter((entry) => entry.isDirectory()).forEach((entry) => {
    const manifestPath = path.join(recordingsRoot, entry.name, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      return;
    }

    try {
      const raw = fs.readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(raw);
      if (manifest && !manifest.endedAt) {
        manifest.endedAt = new Date().toISOString();
        manifest.stopReason = manifest.stopReason || 'crash';
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
        updatedCount += 1;
        logger.warn('Recovered incomplete recording session', { manifestPath });
      }
    } catch (error) {
      logger.error('Failed to recover recording manifest', { manifestPath, error });
    }
  });

  return updatedCount;
};

module.exports = {
  createSessionStore,
  recoverIncompleteSessions
};
