(function (global) {
  const createExclusions = (options = {}) => {
    const elements = options.elements || {}
    const jiminy = options.jiminy || {}
    const getState = typeof options.getState === 'function' ? options.getState : () => ({})
    const setExclusions = typeof options.setExclusions === 'function' ? options.setExclusions : () => {}
    const setMessage = typeof options.setMessage === 'function' ? options.setMessage : () => {}
    const refreshContextGraphStatus = typeof options.refreshContextGraphStatus === 'function'
      ? options.refreshContextGraphStatus
      : async () => {}

    const {
      exclusionsLists = [],
      addExclusionButtons = [],
      exclusionsErrors = []
    } = elements

    const renderExclusions = (exclusions) => {
      exclusionsLists.forEach((list) => {
        list.innerHTML = ''
        for (const exclusion of exclusions) {
          const li = document.createElement('li')
          li.className = 'flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-700 dark:text-zinc-300 group'

          const pathSpan = document.createElement('span')
          pathSpan.className = 'truncate'
          pathSpan.textContent = exclusion
          pathSpan.title = exclusion

          const removeBtn = document.createElement('button')
          removeBtn.className = 'ml-2 px-1.5 py-0.5 rounded text-[11px] text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer'
          removeBtn.textContent = '×'
          removeBtn.title = 'Remove exclusion'
          removeBtn.addEventListener('click', () => removeExclusion(exclusion))

          li.appendChild(pathSpan)
          li.appendChild(removeBtn)
          list.appendChild(li)
        }
      })
    }

    const saveExclusions = async (exclusions) => {
      if (!jiminy.saveSettings) return

      try {
        await jiminy.saveSettings({ exclusions })
        console.log('Exclusions saved', exclusions)
        setMessage(exclusionsErrors, '')
        await refreshContextGraphStatus()
      } catch (error) {
        console.error('Failed to save exclusions', error)
        setMessage(exclusionsErrors, 'Failed to save exclusions.')
      }
    }

    const updateExclusions = (exclusions) => {
      setExclusions(exclusions)
      renderExclusions(exclusions)
      void saveExclusions(exclusions)
    }

    const addExclusion = (path) => {
      const state = getState()
      const currentExclusions = Array.isArray(state.currentExclusions) ? state.currentExclusions : []
      if (!path || currentExclusions.includes(path)) return
      const nextExclusions = [...currentExclusions, path]
      nextExclusions.sort()
      updateExclusions(nextExclusions)
    }

    const removeExclusion = (path) => {
      const state = getState()
      const currentExclusions = Array.isArray(state.currentExclusions) ? state.currentExclusions : []
      const nextExclusions = currentExclusions.filter((item) => item !== path)
      updateExclusions(nextExclusions)
    }

    const handleAddExclusionClick = async () => {
      if (!jiminy.pickExclusion) {
        console.error('pickExclusion not available')
        setMessage(exclusionsErrors, 'Exclusion picker unavailable. Restart the app.')
        return
      }

      const state = getState()
      const contextPath = state.currentContextFolderPath || ''
      if (!contextPath) {
        console.warn('No context folder selected')
        setMessage(exclusionsErrors, 'Select a context folder before adding exclusions.')
        return
      }

      try {
        const result = await jiminy.pickExclusion(contextPath)
        if (result && !result.canceled && result.path) {
          setMessage(exclusionsErrors, '')
          addExclusion(result.path)
        } else if (result && result.error) {
          console.error('Failed to pick exclusion:', result.error)
          setMessage(exclusionsErrors, result.error)
        }
      } catch (error) {
        console.error('Failed to pick exclusion', error)
        setMessage(exclusionsErrors, 'Failed to open exclusion picker.')
      }
    }

    if (addExclusionButtons.length > 0) {
      addExclusionButtons.forEach((button) => {
        button.addEventListener('click', () => {
          void handleAddExclusionClick()
        })
      })
    }

    const setExclusionsValue = (exclusions) => {
      const nextExclusions = Array.isArray(exclusions) ? [...exclusions] : []
      setExclusions(nextExclusions)
      renderExclusions(nextExclusions)
    }

    return {
      setExclusions: setExclusionsValue
    }
  }

  const registry = global.JiminyExclusions || {}
  registry.createExclusions = createExclusions
  global.JiminyExclusions = registry

  // Export for Node/CommonJS so tests can require this module; browsers ignore this.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = registry
  }
})(window)
