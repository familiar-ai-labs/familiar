const path = require('node:path')
const fs = require('node:fs')

const { QUERY_DIR_NAME, SPEEDUP_FACTOR } = require('./constants')
const { toErrorResult } = require('./errors')
const { filterRecordingSessions, estimateRecordingDuration } = require('./session-filter')
const { concatSegments } = require('./concat')
const { speedupVideo } = require('./speedup')
const { processVideoWithGemini } = require('./gemini')
const { parseDateRange, validateQuestion } = require('./validation')

const estimateRecordingQuery = ({ contextFolderPath, fromDate, toDate, logger = console } = {}) => {
  if (!contextFolderPath || typeof contextFolderPath !== 'string') {
    return toErrorResult('CONTEXT_MISSING', 'Context folder path is required.')
  }

  const rangeResult = parseDateRange({ fromDate, toDate })
  if (!rangeResult.ok) {
    return rangeResult
  }

  const filterResult = estimateRecordingDuration({
    contextFolderPath,
    rangeStartMs: rangeResult.startMs,
    rangeEndMs: rangeResult.endMs,
    logger
  })

  if (!filterResult.ok) {
    return filterResult
  }

  return {
    ok: true,
    totalDurationMs: filterResult.totalDurationMs,
    totalSessions: filterResult.totalSessions,
    totalSegments: filterResult.totalSegments
  }
}

const buildQueryId = () => `query-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const ensureDir = (dirPath) => {
  fs.mkdirSync(dirPath, { recursive: true })
}

const runRecordingQuery = async ({
  contextFolderPath,
  question,
  fromDate,
  toDate,
  apiKey,
  logger = console
} = {}) => {
  const analytics = {
    queryId: null,
    fromDate,
    toDate,
    questionLength: typeof question === 'string' ? question.trim().length : 0,
    speedupFactor: SPEEDUP_FACTOR,
    rangeStartMs: null,
    rangeEndMs: null,
    totalEstimatedDurationMs: null,
    totalSessions: null,
    totalSegments: null,
    status: 'started',
    errorCode: null,
    errorMessage: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    steps: {}
  }

  const finalizeAnalytics = (result) => {
    const decoratedResult = (() => {
      if (!result || typeof result !== 'object') {
        return result
      }
      if (analytics.queryDir && !result.queryDir) {
        return { ...result, queryDir: analytics.queryDir }
      }
      return result
    })()

    analytics.status = decoratedResult?.ok ? 'ok' : 'error'
    analytics.errorCode = decoratedResult?.error?.code || null
    analytics.errorMessage = decoratedResult?.error?.message || null
    analytics.finishedAt = new Date().toISOString()
    logger.info('Recording query analytics', analytics)
    if (analytics.queryDir) {
      try {
        const analyticsPath = path.join(analytics.queryDir, 'analytics.json')
        fs.writeFileSync(analyticsPath, `${JSON.stringify(analytics, null, 2)}\n`, 'utf-8')
      } catch (error) {
        logger.warn('Failed to write recording query analytics', { error })
      }
    }
    return decoratedResult
  }

  const questionValidation = validateQuestion(question)
  if (!questionValidation.ok) {
    return finalizeAnalytics(questionValidation)
  }

  if (!contextFolderPath || typeof contextFolderPath !== 'string') {
    return finalizeAnalytics(toErrorResult('CONTEXT_MISSING', 'Context folder path is required.'))
  }

  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
    return finalizeAnalytics(toErrorResult('PROVIDER_UNAVAILABLE', 'Gemini API key is required.'))
  }

  const rangeResult = parseDateRange({ fromDate, toDate })
  if (!rangeResult.ok) {
    return finalizeAnalytics(rangeResult)
  }
  analytics.rangeStartMs = rangeResult.startMs
  analytics.rangeEndMs = rangeResult.endMs

  let queryDir = null

  try {
    logger.info('Recording query started', { fromDate, toDate })

    const withTiming = async (step, fn) => {
      const start = Date.now()
      const result = await fn()
      const durationMs = Date.now() - start
      analytics.steps[step] = {
        durationMs,
        ok: result?.ok !== false,
        errorCode: result?.error?.code || null
      }
      if (result && result.ok === false) {
        logger.error('Recording query step failed', { step, durationMs, error: result.error })
      } else {
        logger.info('Recording query step completed', { step, durationMs })
      }
      return result
    }

    const filterResult = await withTiming('filterSessions', async () => filterRecordingSessions({
      contextFolderPath,
      rangeStartMs: rangeResult.startMs,
      rangeEndMs: rangeResult.endMs,
      logger
    }))

    if (!filterResult.ok) {
      return finalizeAnalytics(filterResult)
    }

    const queryRoot = path.join(filterResult.recordingsRoot, QUERY_DIR_NAME)
    const queryId = buildQueryId()
    queryDir = path.join(queryRoot, queryId)
    analytics.queryId = queryId
    analytics.queryDir = queryDir
    analytics.totalEstimatedDurationMs = filterResult.totalDurationMs
    analytics.totalSessions = filterResult.totalSessions
    analytics.totalSegments = filterResult.totalSegments
    ensureDir(queryDir)

    const segmentsListPath = path.join(queryDir, 'segments.txt')
    const combinedPath = path.join(queryDir, 'combined.mp4')
    const speedupPath = path.join(queryDir, 'combined-speedup.mp4')

    const concatResult = await withTiming('concat', async () => concatSegments({
      segments: filterResult.allSegments,
      listPath: segmentsListPath,
      outputPath: combinedPath,
      logger
    }))
    if (!concatResult.ok) {
      return finalizeAnalytics(concatResult)
    }

    const speedupResult = await withTiming('speedup', async () => speedupVideo({
      inputPath: combinedPath,
      outputPath: speedupPath,
      speedFactor: SPEEDUP_FACTOR,
      logger
    }))
    if (!speedupResult.ok) {
      return finalizeAnalytics(speedupResult)
    }

    const geminiResult = await withTiming('gemini', async () => processVideoWithGemini({
      videoPath: speedupPath,
      question,
      apiKey,
      logger
    }))
    if (!geminiResult.ok) {
      return finalizeAnalytics(geminiResult)
    }

    try {
      const resultPath = path.join(queryDir, 'result.md')
      fs.writeFileSync(resultPath, `${geminiResult.answerText || ''}\n`, 'utf-8')
    } catch (error) {
      logger.warn('Failed to write recording query result', { error })
    }

    return finalizeAnalytics({ ok: true, answerText: geminiResult.answerText })
  } catch (error) {
    logger.error('Recording query failed', { error })
    return finalizeAnalytics(toErrorResult('QUERY_FAILED', error?.message || 'Recording query failed.'))
  } finally {
    // Keeping query artifacts for debugging; no cleanup.
    // cleanupQueryWorkspace({ queryDir, logger })
  }
}

module.exports = {
  runRecordingQuery,
  estimateRecordingQuery
}
