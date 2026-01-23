const { constructContextGraphSkeleton, MAX_NODES } = require('./graphSkeleton')

const collectFileSummaries = (nodes, folderId, cache) => {
  if (cache.has(folderId)) {
    return cache.get(folderId)
  }

  const node = nodes[folderId]
  const summaries = []

  for (const childId of node.children || []) {
    const child = nodes[childId]
    if (!child) {
      continue
    }

    if (child.type === 'file') {
      if (child.summary) {
        summaries.push({ relativePath: child.relativePath, summary: child.summary })
      }
    } else if (child.type === 'folder') {
      summaries.push(...collectFileSummaries(nodes, childId, cache))
    }
  }

  cache.set(folderId, summaries)
  return summaries
}

const formatSummaries = (summaries) => summaries
  .map((item) => `- ${item.relativePath}: ${item.summary}`)
  .join('\n')

const syncContextGraph = async ({
  rootPath,
  store,
  summarizer,
  onProgress = () => {},
  logger = console,
  maxNodes = MAX_NODES,
  exclusions = []
}) => {
  const start = Date.now()
  logger.log('Context graph sync started', { rootPath })

  const previousGraph = store.load()
  const previousNodes = previousGraph?.nodes || {}

  const scanResult = constructContextGraphSkeleton(rootPath, { logger, maxNodes, exclusions })
  const {
    nodes,
    rootId,
    counts,
    fileIds,
    folderIds,
    folderDepths,
    fileContents,
    errors,
    warnings
  } = scanResult

  const total = counts.files + counts.folders
  let completed = 0
  const markProgress = (node, phase) => {
    completed += 1
    onProgress({
      completed,
      total,
      phase,
      type: node.type,
      relativePath: node.relativePath
    })
  }

  const now = new Date().toISOString()

  for (const fileId of fileIds) {
    const node = nodes[fileId]
    const previous = previousNodes[fileId]
    const content = fileContents.get(fileId)

    if (
      previous &&
      previous.contentHash &&
      node.contentHash &&
      previous.contentHash === node.contentHash &&
      typeof previous.summary === 'string' &&
      previous.summary.trim().length > 0
    ) {
      node.summary = previous.summary
      node.summaryUpdatedAt = previous.summaryUpdatedAt || null
      markProgress(node, 'file:cached')
      continue
    }

    if (!content) {
      errors.push({ path: node.relativePath, message: 'File content unavailable for summary.' })
      markProgress(node, 'file:skipped')
      continue
    }

    try {
      const summary = await summarizer.summarizeFile({
        relativePath: node.relativePath,
        content
      })
      if (!summary || summary.trim().length === 0) {
        throw new Error('LLM returned empty summary.')
      }

      node.summary = summary
      node.summaryUpdatedAt = now
      markProgress(node, 'file:summarized')
    } catch (error) {
      errors.push({ path: node.relativePath, message: error.message })
      logger.error('Failed to summarize file', { path: node.relativePath, error })
      markProgress(node, 'file:error')
    }
  }

  const folderOrder = [...folderIds].sort((a, b) => (folderDepths.get(b) || 0) - (folderDepths.get(a) || 0))
  const folderSummaryCache = new Map()

  for (const folderId of folderOrder) {
    const node = nodes[folderId]
    const summaries = collectFileSummaries(nodes, folderId, folderSummaryCache)

    if (summaries.length === 0) {
      node.summary = ''
      node.summaryUpdatedAt = null
      markProgress(node, 'folder:empty')
      continue
    }

    try {
      const summary = await summarizer.summarizeFolder({
        relativePath: node.relativePath,
        summaries: formatSummaries(summaries)
      })
      if (!summary || summary.trim().length === 0) {
        throw new Error('LLM returned empty summary.')
      }

      node.summary = summary
      node.summaryUpdatedAt = now
      markProgress(node, 'folder:summarized')
    } catch (error) {
      errors.push({ path: node.relativePath, message: error.message })
      logger.error('Failed to summarize folder', { path: node.relativePath, error })
      markProgress(node, 'folder:error')
    }
  }

  const graph = {
    version: 1,
    rootPath,
    generatedAt: now,
    model: summarizer.model || null,
    rootId,
    counts,
    nodes: Object.fromEntries(
      Object.entries(nodes).map(([id, node]) => [id, node.toJSON ? node.toJSON() : node])
    )
  }

  store.save(graph)

  const durationMs = Date.now() - start
  logger.log('Context graph sync completed', {
    rootPath,
    files: counts.files,
    folders: counts.folders,
    errors: errors.length,
    durationMs
  })

  return { graph, errors, warnings, durationMs }
}

module.exports = {
  syncContextGraph,
  MAX_NODES
}
