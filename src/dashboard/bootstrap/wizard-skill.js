(function registerBootstrapWizardSkill(global) {
  function bootstrapWizardSkill(options = {}) {
    const targetWindow = options.window
    if (!targetWindow || !targetWindow.JiminyWizardSkill || typeof targetWindow.JiminyWizardSkill.createWizardSkill !== 'function') {
      return null
    }

    return targetWindow.JiminyWizardSkill.createWizardSkill({
      elements: options.elements,
      jiminy: options.jiminy,
      getState: options.getState,
      setSkillHarness: options.setSkillHarness,
      setSkillInstalled: options.setSkillInstalled,
      setMessage: options.setMessage,
      updateWizardUI: options.updateWizardUI
    })
  }

  const registry = global.JiminyDashboardBootstrap || {}
  registry.bootstrapWizardSkill = bootstrapWizardSkill
  global.JiminyDashboardBootstrap = registry

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { bootstrapWizardSkill }
  }
})(typeof window !== 'undefined' ? window : global)
