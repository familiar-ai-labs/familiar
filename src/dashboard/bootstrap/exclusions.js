(function registerBootstrapExclusions(global) {
  function bootstrapExclusions(options = {}) {
    const targetWindow = options.window
    if (!targetWindow || !targetWindow.JiminyExclusions || typeof targetWindow.JiminyExclusions.createExclusions !== 'function') {
      return null
    }

    return targetWindow.JiminyExclusions.createExclusions({
      elements: options.elements,
      jiminy: options.jiminy,
      getState: options.getState,
      setExclusions: options.setExclusions,
      setMessage: options.setMessage,
      refreshContextGraphStatus: options.refreshContextGraphStatus
    })
  }

  const registry = global.JiminyDashboardBootstrap || {}
  registry.bootstrapExclusions = bootstrapExclusions
  global.JiminyDashboardBootstrap = registry

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { bootstrapExclusions }
  }
})(typeof window !== 'undefined' ? window : global)
