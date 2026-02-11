(function registerProcessingEngine(global) {
  const ACTIVE_CLASSES = [
    'bg-white',
    'dark:bg-zinc-800',
    'shadow-sm',
    'text-zinc-900',
    'dark:text-zinc-100'
  ]

  const INACTIVE_CLASSES = [
    'text-zinc-500',
    'dark:text-zinc-400',
    'hover:text-zinc-700',
    'dark:hover:text-zinc-300'
  ]

  const toggleClasses = (element, classes, isActive) => {
    if (!element) {
      return
    }
    classes.forEach((className) => {
      element.classList.toggle(className, isActive)
    })
  }

  const normalizeMode = (value) => {
    const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
    return raw === 'apple_vision_ocr' ? 'apple_vision_ocr' : 'llm'
  }

  function createProcessingEngine(options = {}) {
    const elements = options.elements || {}
    const processingEngineRoots = Array.isArray(elements.processingEngineRoots) ? elements.processingEngineRoots : []

    const findSelect = (root) => root?.querySelector?.('[data-setting="stills-markdown-extractor"]') || null

    const updateRoot = (root) => {
      const select = findSelect(root)
      if (!select) {
        return
      }

      const mode = normalizeMode(select.value)
      const cloudButton = root.querySelector?.('[data-processing-engine-mode="llm"]') || null
      const localButton = root.querySelector?.('[data-processing-engine-mode="apple_vision_ocr"]') || null
      const cloudPanel = root.querySelector?.('[data-processing-engine-panel="llm"]') || null
      const localPanel = root.querySelector?.('[data-processing-engine-panel="apple_vision_ocr"]') || null

      const isCloud = mode === 'llm'
      toggleClasses(cloudButton, ACTIVE_CLASSES, isCloud)
      toggleClasses(cloudButton, INACTIVE_CLASSES, !isCloud)
      toggleClasses(localButton, ACTIVE_CLASSES, !isCloud)
      toggleClasses(localButton, INACTIVE_CLASSES, isCloud)

      if (cloudPanel) {
        cloudPanel.classList.toggle('hidden', !isCloud)
      }
      if (localPanel) {
        localPanel.classList.toggle('hidden', isCloud)
      }

      if (cloudButton) {
        cloudButton.setAttribute('aria-pressed', String(isCloud))
      }
      if (localButton) {
        localButton.setAttribute('aria-pressed', String(!isCloud))
      }
    }

    const updateProcessingEngineUI = () => {
      for (const root of processingEngineRoots) {
        updateRoot(root)
      }
    }

    const setMode = (root, mode) => {
      const select = findSelect(root)
      if (!select) {
        return
      }
      const nextValue = normalizeMode(mode)
      if (select.value !== nextValue) {
        select.value = nextValue
      }
      // Triggers the existing settings save pipeline (and syncs the hidden selects).
      select.dispatchEvent(new Event('change', { bubbles: true }))
    }

    for (const root of processingEngineRoots) {
      const cloudButton = root.querySelector?.('[data-processing-engine-mode="llm"]') || null
      const localButton = root.querySelector?.('[data-processing-engine-mode="apple_vision_ocr"]') || null
      const select = findSelect(root)

      if (cloudButton) {
        cloudButton.addEventListener('click', () => {
          setMode(root, 'llm')
          updateProcessingEngineUI()
        })
      }

      if (localButton) {
        localButton.addEventListener('click', () => {
          setMode(root, 'apple_vision_ocr')
          updateProcessingEngineUI()
        })
      }

      if (select) {
        select.addEventListener('change', () => {
          updateProcessingEngineUI()
        })
      }
    }

    updateProcessingEngineUI()

    return {
      updateProcessingEngineUI
    }
  }

  const registry = global.FamiliarProcessingEngine || {}
  registry.createProcessingEngine = createProcessingEngine
  global.FamiliarProcessingEngine = registry

  // Export for Node/CommonJS so tests can require this module; browsers ignore this.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = registry
  }
})(typeof window !== 'undefined' ? window : global)
