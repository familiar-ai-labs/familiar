(function registerBootstrapUpdates(global) {
  function bootstrapUpdates(options = {}) {
    const targetWindow = options.window
    if (!targetWindow || !targetWindow.JiminyUpdates || typeof targetWindow.JiminyUpdates.createUpdates !== 'function') {
      return null
    }

    return targetWindow.JiminyUpdates.createUpdates({
      elements: options.elements,
      jiminy: options.jiminy,
      setMessage: options.setMessage
    })
  }

  const registry = global.JiminyDashboardBootstrap || {}
  registry.bootstrapUpdates = bootstrapUpdates
  global.JiminyDashboardBootstrap = registry

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { bootstrapUpdates }
  }
})(typeof window !== 'undefined' ? window : global)
