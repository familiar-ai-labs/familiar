const { systemPreferences } = require('electron');

const getScreenRecordingPermissionStatus = () => {
  if (process.platform !== 'darwin') {
    return 'unavailable';
  }
  try {
    return systemPreferences.getMediaAccessStatus('screen');
  } catch (error) {
    return 'unknown';
  }
};

const isScreenRecordingPermissionGranted = () =>
  getScreenRecordingPermissionStatus() === 'granted';

module.exports = {
  getScreenRecordingPermissionStatus,
  isScreenRecordingPermissionGranted
};
