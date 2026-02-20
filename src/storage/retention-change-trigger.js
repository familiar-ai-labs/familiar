function createRetentionChangeTrigger({
  resolveRetentionDays,
  onRetentionChanged,
  initialRetentionDays = null
} = {}) {
  if (typeof resolveRetentionDays !== 'function') {
    throw new Error('resolveRetentionDays is required')
  }
  if (typeof onRetentionChanged !== 'function') {
    throw new Error('onRetentionChanged is required')
  }

  let lastRetentionDays = Number.isFinite(initialRetentionDays) ? initialRetentionDays : null

  return {
    handle(nextRetentionValue) {
      const retentionDays = resolveRetentionDays(nextRetentionValue)
      if (lastRetentionDays === null) {
        lastRetentionDays = retentionDays
        return false
      }
      if (retentionDays === lastRetentionDays) {
        return false
      }
      lastRetentionDays = retentionDays
      onRetentionChanged(retentionDays)
      return true
    },
    getLastRetentionDays() {
      return lastRetentionDays
    }
  }
}

module.exports = {
  createRetentionChangeTrigger
}
