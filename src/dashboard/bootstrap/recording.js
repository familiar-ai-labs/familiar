(function registerBootstrapRecording(global) {
  function bootstrapRecording(options = {}) {
    const targetWindow = options.window
    if (!targetWindow || !targetWindow.JiminyRecording || typeof targetWindow.JiminyRecording.createRecording !== 'function') {
      return null
    }

    return targetWindow.JiminyRecording.createRecording({
      elements: options.elements,
      jiminy: options.jiminy,
      getState: options.getState
    })
  }

  const registry = global.JiminyDashboardBootstrap || {}
  registry.bootstrapRecording = bootstrapRecording
  global.JiminyDashboardBootstrap = registry

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { bootstrapRecording }
  }
})(typeof window !== 'undefined' ? window : global)
