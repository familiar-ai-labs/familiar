const { loadSettings } = require('../../settings')
const { enqueueAnalysis } = require('../../analysis')
const { showProviderExhaustedNotification } = require('../../notifications')
const { ExhaustedLlmProviderError } = require('../../modelProviders')
const { runImageExtraction } = require('./index')

const isLlmMockEnabled = () => process.env.JIMINY_LLM_MOCK === '1'

const handleImageExtractionEvent = async (event) => {
  const imagePath = event?.metadata?.path
  if (!imagePath) {
    console.warn('Skipping image extraction due to missing image path', { event })
    return { skipped: true, reason: 'missing_path' }
  }

  const settings = loadSettings()
  const provider = settings?.llm_provider?.provider || ''
  const apiKey = settings?.llm_provider?.api_key || ''
  const model = typeof settings?.llm_provider?.vision_model === 'string' && settings.llm_provider.vision_model.trim()
    ? settings.llm_provider.vision_model
    : undefined
  if (!provider) {
    console.warn('Skipping image extraction due to missing LLM provider', { imagePath })
    return { skipped: true, reason: 'missing_provider' }
  }
  if (!apiKey && !isLlmMockEnabled()) {
    console.warn('Skipping image extraction due to missing LLM API key', { imagePath })
    return { skipped: true, reason: 'missing_api_key' }
  }

  console.log('Starting image extraction', { imagePath, provider, model })

  let extractionResult
  try {
    extractionResult = await runImageExtraction({
      provider,
      apiKey,
      model,
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
