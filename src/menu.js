function buildTrayMenuTemplate ({
  onRecordingPause,
  onOpenSettings,
  onQuit,
  recordingAccelerator,
  recordingPaused,
  recordingState
}) {
  const stillsState = recordingState && typeof recordingState === 'object' ? recordingState.state : ''
  const isRecording = stillsState === 'recording' || stillsState === 'idleGrace'
  const recordingLabel = recordingPaused
    ? 'Resume Recording'
    : isRecording
      ? 'Pause Recording (10 min)'
      : 'Start Recording'
  const recordingItem = { label: recordingLabel, click: onRecordingPause }
  if (typeof recordingAccelerator === 'string' && recordingAccelerator) {
    recordingItem.accelerator = recordingAccelerator
  }

  return [
    recordingItem,
    { label: 'Settings', click: onOpenSettings },
    { type: 'separator' },
    { label: 'Quit', click: onQuit }
  ]
}

module.exports = { buildTrayMenuTemplate }
