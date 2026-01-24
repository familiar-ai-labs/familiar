const path = require('path')
const { loadSettings } = require('../settings')
const { JsonContextGraphStore } = require('../context-graph')
const { runAnalysis } = require('./processor')
const { showToast } = require('../toast')

const shortenPath = (fullPath, maxComponents = 2) => {
  const parts = fullPath.split(path.sep).filter(Boolean)
  if (parts.length <= maxComponents) {
    return fullPath
  }
  return '.../' + parts.slice(-maxComponents).join('/')
}

const isLlmMockEnabled = () => process.env.JIMINY_LLM_MOCK === '1'

const createAnalysisHandler = ({
  loadSettingsImpl = loadSettings,
  createStore = ({ contextFolderPath } = {}) => new JsonContextGraphStore({ contextFolderPath }),
  runAnalysisImpl = runAnalysis
} = {}) => async (event) => {
  const resultMdPath = event?.result_md_path
  if (!resultMdPath) {
    console.warn('Skipping analysis due to missing result markdown path', { event })
    return { skipped: true, reason: 'missing_result_md_path' }
  }

  const settings = loadSettingsImpl()
  const provider = settings?.llm_provider?.provider || ''
  const apiKey = settings?.llm_provider?.api_key || ''
  const model = typeof settings?.llm_provider?.text_model === 'string' && settings.llm_provider.text_model.trim()
    ? settings.llm_provider.text_model
    : undefined
  if (!provider) {
    console.warn('Skipping analysis due to missing LLM provider', { resultMdPath })
    return { skipped: true, reason: 'missing_provider' }
  }
  if (!apiKey && !isLlmMockEnabled()) {
    console.warn('Skipping analysis due to missing LLM API key', { resultMdPath })
    return { skipped: true, reason: 'missing_api_key' }
  }

  const contextFolderPath = settings?.contextFolderPath || ''
  const store = createStore({ contextFolderPath })
  const contextGraph = store.load()

  if (!contextFolderPath && !contextGraph?.rootPath) {
    console.warn('Skipping analysis due to missing context folder path', { resultMdPath })
    return { skipped: true, reason: 'missing_context_folder' }
  }

  console.log('Starting analysis for result markdown', { resultMdPath, provider, model })

  const result = await runAnalysisImpl({
    resultMdPath,
    contextGraph,
    contextFolderPath,
    provider,
    apiKey,
    model
  })

  console.log('Analysis saved', {
    resultMdPath,
    outputPath: result.outputPath,
    relevantNodeId: result.relevantNodeId
  })

  const nodeName = result.relevantNodeName || 'General'
  const shortPath = shortenPath(result.outputPath)
  showToast({
    title: 'Analysis Complete',
    body: `Context: ${nodeName}\nSaved: ${shortPath}`,
    type: 'success',
    duration: 15000
  })

  return result
}

const handleAnalysisEvent = createAnalysisHandler()

module.exports = {
  handleAnalysisEvent,
  createAnalysisHandler
}
