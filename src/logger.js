const fs = require('node:fs')
const path = require('node:path')
const util = require('node:util')
const { resolveSettingsDir } = require('./settings')

const MAX_LOG_SIZE_BYTES = 10 * 1024
const LOG_FILENAME = 'jiminy.log'
const LOG_BACKUP_FILENAME = 'jiminy.log.1'

let initialized = false

const ensureDirectory = (dirPath) => {
  fs.mkdirSync(dirPath, { recursive: true })
}

const rotateIfNeeded = (logFilePath, backupFilePath) => {
  try {
    const stats = fs.statSync(logFilePath)
    if (stats.size < MAX_LOG_SIZE_BYTES) {
      return
    }

    if (fs.existsSync(backupFilePath)) {
      fs.unlinkSync(backupFilePath)
    }

    fs.renameSync(logFilePath, backupFilePath)
  } catch (error) {
    if (error && error.code !== 'ENOENT') {
      // Avoid throwing if we cannot rotate; still allow logging to continue.
    }
  }
}

const createLogger = () => {
  const logDirectory = path.join(resolveSettingsDir(), 'logs')
  const logFilePath = path.join(logDirectory, LOG_FILENAME)
  const backupFilePath = path.join(logDirectory, LOG_BACKUP_FILENAME)

  const writeLine = (level, args) => {
    try {
      ensureDirectory(logDirectory)
      rotateIfNeeded(logFilePath, backupFilePath)
      const message = util.format(...args)
      const line = `${new Date().toISOString()} [${level}] ${message}\n`
      fs.appendFileSync(logFilePath, line, 'utf8')
    } catch (error) {
      // Ignore logging failures to avoid crashing the app.
    }
  }

  return { writeLine }
}

const initLogging = () => {
  if (initialized) {
    return
  }

  initialized = true

  const { writeLine } = createLogger()
  const originalConsole = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console)
  }

  const wrap = (level, original) => (...args) => {
    writeLine(level, args)
    original(...args)
  }

  console.log = wrap('INFO', originalConsole.log)
  console.info = wrap('INFO', originalConsole.info)
  console.warn = wrap('WARN', originalConsole.warn)
  console.error = wrap('ERROR', originalConsole.error)
}

module.exports = {
  initLogging
}
