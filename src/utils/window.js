const showWindow = (windowInstance, options = {}) => {
  if (!windowInstance) {
    return { shown: false, focused: false, reason: 'missing_window' }
  }

  const focus = options.focus !== false
  const allowShow = options.allowShow !== false

  if (typeof windowInstance.isMinimized === 'function' && windowInstance.isMinimized()) {
    if (typeof windowInstance.restore === 'function') {
      windowInstance.restore()
    }
  }

  if (!allowShow) {
    return { shown: false, focused: false, reason: 'show_disabled' }
  }

  const isVisible = typeof windowInstance.isVisible === 'function'
    ? windowInstance.isVisible()
    : true

  if (!focus) {
    if (isVisible) {
      return { shown: false, focused: false, reason: 'already_visible' }
    }

    if (typeof windowInstance.showInactive === 'function') {
      windowInstance.showInactive()
    } else if (typeof windowInstance.show === 'function') {
      windowInstance.show()
    }

    return { shown: true, focused: false, reason: 'shown_inactive' }
  }

  if (typeof windowInstance.show === 'function') {
    windowInstance.show()
  }

  if (typeof windowInstance.focus === 'function') {
    windowInstance.focus()
  }

  return { shown: true, focused: true, reason: 'shown_focused' }
}

module.exports = {
  showWindow
}
