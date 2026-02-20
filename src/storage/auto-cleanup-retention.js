(function registerAutoCleanupRetention(global) {
  const AUTO_CLEANUP_RETENTION_DAYS = Object.freeze({
    TWO_DAYS: 2,
    SEVEN_DAYS: 7
  })

  const DEFAULT_AUTO_CLEANUP_RETENTION_DAYS = AUTO_CLEANUP_RETENTION_DAYS.TWO_DAYS

  function isAllowedAutoCleanupRetentionDays(value) {
    return (
      value === AUTO_CLEANUP_RETENTION_DAYS.TWO_DAYS ||
      value === AUTO_CLEANUP_RETENTION_DAYS.SEVEN_DAYS
    )
  }

  function resolveAutoCleanupRetentionDays(value) {
    const numericValue = Number(value)
    if (isAllowedAutoCleanupRetentionDays(numericValue)) {
      return numericValue
    }
    return DEFAULT_AUTO_CLEANUP_RETENTION_DAYS
  }

  const api = {
    AUTO_CLEANUP_RETENTION_DAYS,
    DEFAULT_AUTO_CLEANUP_RETENTION_DAYS,
    isAllowedAutoCleanupRetentionDays,
    resolveAutoCleanupRetentionDays
  }

  global.FamiliarAutoCleanupRetention = api

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api
  }
})(typeof window !== 'undefined' ? window : global)
