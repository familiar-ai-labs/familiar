const { loadSettings } = require('../../settings')
const { enqueueAnalysis } = require('../../analysis')
const { showProviderExhaustedNotification } = require('../../notifications')
const { ExhaustedLlmProviderError } = require('../../modelProviders/gemini')
const { DEFAULT_VISION_MODEL, runImageExtraction } = require('./index')

const isLlmMockEnabled = () => process.env.JIMINY_LLM_MOCK === '1'

const handleImageExtractionEvent = async (event) => {
  const imagePath = event?.metadata?.path
  if (!imagePath) {
    console.warn('Skipping image extraction due to missing image path', { event })
    return { skipped: true, reason: 'missing_path' }
  }

  const settings = loadSettings()
  const apiKey = settings?.llm_provider?.api_key || ''
  if (!apiKey && !isLlmMockEnabled()) {
    console.warn('Skipping image extraction due to missing LLM API key', { imagePath })
    return { skipped: true, reason: 'missing_api_key' }
  }

  console.log('Starting image extraction', { imagePath, model: DEFAULT_VISION_MODEL })

  let extractionResult
  try {
    extractionResult = await runImageExtraction({
      apiKey,
      model: DEFAULT_VISION_MODEL,
      imagePath
    })
  } catch (error) {
    if (error instanceof ExhaustedLlmProviderError) {
      console.warn('LLM provider exhausted during image extraction', {
        imagePath,
        message: error.message
      })
      showProviderExhaustedNotification({ source: 'image_extraction' })
      return { skipped: true, reason: 'provider_exhausted' }
    }

    throw error
  }

  const { outputPath, markdown } = extractionResult

  console.log('Image extraction saved', {
    imagePath,
    outputPath,
    chars: markdown.length
  })

  void enqueueAnalysis({ result_md_path: outputPath })
    .catch((error) => {
      console.error('Failed to enqueue analysis event', { error, outputPath })
    })

  return { outputPath }
}

module.exports = {
  handleImageExtractionEvent
}
