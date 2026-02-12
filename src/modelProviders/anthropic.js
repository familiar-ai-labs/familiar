const { withHttpRetry, RetryableError } = require('../utils/retry')
const { InvalidLlmProviderApiKeyError } = require('./errors')

const ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1'
const DEFAULT_ANTHROPIC_TEXT_MODEL = 'claude-haiku-4-5'
const DEFAULT_ANTHROPIC_VISION_MODEL = 'claude-haiku-4-5'
const ANTHROPIC_FALLBACK_TEXT_MODELS = [
  'claude-haiku-4-5-20251001',
  'claude-sonnet-4-5',
  'claude-sonnet-4-5-20250929',
  'claude-sonnet-4-0',
  'claude-sonnet-4-20250514',
  'claude-3-7-sonnet-latest',
  'claude-3-7-sonnet-20250219',
  'claude-3-5-haiku-latest',
  'claude-3-5-haiku-20241022'
]
const ANTHROPIC_FALLBACK_VISION_MODELS = [...ANTHROPIC_FALLBACK_TEXT_MODELS]
const DEFAULT_ANTHROPIC_MAX_TOKENS = 2048
const RETIRED_ANTHROPIC_MODELS = new Set([
  'claude-3-5-sonnet-20240620',
  'claude-3-5-sonnet-latest'
])

class AnthropicModelNotFoundError extends Error {
  constructor({ context, status, model, message } = {}) {
    super(`Anthropic ${context} model not found: ${model || 'unknown'}`)
    this.name = 'AnthropicModelNotFoundError'
    this.context = context || 'unknown'
    this.status = status || 404
    this.model = model || null
    this.responseMessage = message || ''
  }
}

const logAnthropicFailure = ({ context, status, message }) => {
  console.warn(`Anthropic ${context} request failed`, { status, message })
}

const parseAnthropicErrorPayload = (message) => {
  if (typeof message !== 'string') {
    return null
  }

  try {
    return JSON.parse(message)
  } catch (_error) {
    return null
  }
}

const extractModelNotFound = ({ status, message } = {}) => {
  if (status !== 404) {
    return null
  }

  const payload = parseAnthropicErrorPayload(message)
  const errorType = payload?.error?.type
  const errorMessage = payload?.error?.message
  if (errorType !== 'not_found_error' || typeof errorMessage !== 'string') {
    return null
  }

  if (!errorMessage.toLowerCase().includes('model')) {
    return null
  }

  const match = errorMessage.match(/model:\s*([^\s]+)/i)
  return match?.[1] || null
}

const parseAnthropicError = ({ status, message }) => {
  if (status === 401 || status === 403) {
    const normalized = (message || '').toLowerCase()
    if (normalized.includes('invalid api key') || normalized.includes('authentication_error')) {
      return new InvalidLlmProviderApiKeyError({
        provider: 'anthropic',
        status,
        message: 'Anthropic API key is invalid.'
      })
    }
  }
  return null
}

const buildAnthropicHeaders = (apiKey) => {
  if (!apiKey) {
    throw new Error('LLM API key is required for Anthropic requests.')
  }

  return {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01'
  }
}

const extractTextFromResponse = (payload) => {
  const content = payload?.content
  if (!Array.isArray(content)) {
    return ''
  }

  return content.map((part) => part?.text || '').join('')
}

const listAnthropicModelIds = async ({ apiKey } = {}) => {
  const url = `${ANTHROPIC_BASE_URL}/models`
  const retryingFetch = withHttpRetry(fetch)

  try {
    const response = await retryingFetch(url, {
      method: 'GET',
      headers: buildAnthropicHeaders(apiKey)
    })
    if (!response.ok) {
      const message = await response.text()
      logAnthropicFailure({ context: 'models', status: response.status, message })
      return []
    }

    const payload = await response.json()
    const modelList = Array.isArray(payload?.data) ? payload.data : []
    return modelList
      .map((entry) => (typeof entry?.id === 'string' ? entry.id.trim() : ''))
      .filter((id) => id.length > 0 && id.toLowerCase().startsWith('claude-'))
  } catch (error) {
    if (error instanceof RetryableError) {
      logAnthropicFailure({ context: 'models', status: error.status, message: error.message })
      return []
    }

    logAnthropicFailure({
      context: 'models',
      status: null,
      message: error instanceof Error ? error.message : String(error)
    })
    return []
  }
}

const requestAnthropic = async ({ apiKey, payload, context } = {}) => {
  const url = `${ANTHROPIC_BASE_URL}/messages`
  const retryingFetch = withHttpRetry(fetch)

  try {
    const response = await retryingFetch(url, {
      method: 'POST',
      headers: buildAnthropicHeaders(apiKey),
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const message = await response.text()
      logAnthropicFailure({ context, status: response.status, message })
      const parsedError = parseAnthropicError({ status: response.status, message })
      if (parsedError) {
        throw parsedError
      }
      const missingModel = extractModelNotFound({ status: response.status, message })
      if (missingModel) {
        throw new AnthropicModelNotFoundError({
          context,
          status: response.status,
          model: missingModel,
          message
        })
      }
      throw new Error(`Anthropic ${context} request failed: ${response.status} ${message}`)
    }

    return response
  } catch (error) {
    if (error instanceof RetryableError) {
      logAnthropicFailure({ context, status: error.status, message: error.message })
      throw error
    }

    throw error
  }
}

const isModelNotFoundError = (error) => {
  if (error instanceof AnthropicModelNotFoundError) {
    return true
  }

  const message = error?.message || ''
  return /not_found_error/i.test(message) && /model/i.test(message)
}

const toCandidateModels = ({ model, fallbackModels = [] } = {}) => {
  const candidates = [model, ...fallbackModels].filter((value) => typeof value === 'string' && value.trim().length > 0)
  return [...new Set(candidates)]
}

const normalizeConfiguredModel = ({ model, defaultModel } = {}) => {
  if (typeof model !== 'string' || model.trim().length === 0) {
    return defaultModel
  }

  const trimmed = model.trim()
  if (RETIRED_ANTHROPIC_MODELS.has(trimmed)) {
    console.warn('Anthropic configured model is retired. Using default model instead.', {
      fromModel: trimmed,
      toModel: defaultModel
    })
    return defaultModel
  }

  return trimmed
}

const requestAnthropicWithFallback = async ({
  apiKey,
  model,
  context,
  fallbackModels = [],
  onModelFallback,
  discoverFallbackModels,
  buildPayload
} = {}) => {
  const models = toCandidateModels({ model, fallbackModels })
  if (models.length === 0) {
    throw new Error('Anthropic model is required.')
  }

  let lastError = null
  let hasTriedDiscoveredFallbacks = false
  for (let index = 0; index < models.length; index += 1) {
    const currentModel = models[index]
    try {
      const response = await requestAnthropic({
        apiKey,
        context,
        payload: buildPayload(currentModel)
      })
      return { response, model: currentModel }
    } catch (error) {
      lastError = error
      if (!isModelNotFoundError(error)) {
        throw error
      }

      if (!models[index + 1] && !hasTriedDiscoveredFallbacks && typeof discoverFallbackModels === 'function') {
        hasTriedDiscoveredFallbacks = true
        const discoveredModels = await discoverFallbackModels({
          context,
          missingModel: error.model || currentModel,
          attemptedModels: [...models]
        })
        const uniqueDiscoveredModels = toCandidateModels({ fallbackModels: discoveredModels })
          .filter((candidateModel) => !models.includes(candidateModel))
        if (uniqueDiscoveredModels.length > 0) {
          models.push(...uniqueDiscoveredModels)
        }
      }

      const nextModel = models[index + 1]
      if (!nextModel) {
        throw error
      }

      console.warn('Anthropic model not found. Retrying with fallback model.', {
        context,
        fromModel: currentModel,
        toModel: nextModel
      })
      if (typeof onModelFallback === 'function') {
        onModelFallback({ context, fromModel: currentModel, toModel: nextModel })
      }
    }
  }

  throw lastError
}

const generateText = async ({
  apiKey,
  model,
  prompt,
  fallbackModels,
  onModelFallback,
  discoverFallbackModels
} = {}) => {
  const { response } = await requestAnthropicWithFallback({
    apiKey,
    model,
    context: 'text',
    fallbackModels,
    onModelFallback,
    discoverFallbackModels,
    buildPayload: (candidateModel) => ({
      model: candidateModel,
      max_tokens: DEFAULT_ANTHROPIC_MAX_TOKENS,
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }]
    })
  })

  const payload = await response.json()
  return extractTextFromResponse(payload).trim()
}

const generateVisionText = async ({
  apiKey,
  model,
  prompt,
  imageBase64,
  mimeType = 'image/png',
  fallbackModels,
  onModelFallback,
  discoverFallbackModels
} = {}) => {
  if (!imageBase64) {
    throw new Error('Image data is required for Anthropic vision extraction.')
  }

  const { response } = await requestAnthropicWithFallback({
    apiKey,
    model,
    context: 'vision',
    fallbackModels,
    onModelFallback,
    discoverFallbackModels,
    buildPayload: (candidateModel) => ({
      model: candidateModel,
      max_tokens: DEFAULT_ANTHROPIC_MAX_TOKENS,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: imageBase64
              }
            }
          ]
        }
      ]
    })
  })

  const payload = await response.json()
  return extractTextFromResponse(payload).trim()
}

const generateVisionBatchText = async ({
  apiKey,
  model,
  prompt,
  images,
  fallbackModels,
  onModelFallback,
  discoverFallbackModels
} = {}) => {
  if (!Array.isArray(images) || images.length === 0) {
    throw new Error('Images are required for Anthropic vision batch extraction.')
  }

  const content = [{ type: 'text', text: prompt }]
  for (const image of images) {
    if (!image?.imageBase64) {
      throw new Error('Image data is required for Anthropic vision batch extraction.')
    }
    const mimeType = image.mimeType || 'image/png'
    content.push({ type: 'text', text: `Image id: ${image.id}` })
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: mimeType,
        data: image.imageBase64
      }
    })
  }

  const { response } = await requestAnthropicWithFallback({
    apiKey,
    model,
    context: 'vision',
    fallbackModels,
    onModelFallback,
    discoverFallbackModels,
    buildPayload: (candidateModel) => ({
      model: candidateModel,
      max_tokens: DEFAULT_ANTHROPIC_MAX_TOKENS,
      messages: [{ role: 'user', content }]
    })
  })

  const payload = await response.json()
  return extractTextFromResponse(payload).trim()
}

const createAnthropicProvider = ({
  apiKey,
  textModel = DEFAULT_ANTHROPIC_TEXT_MODEL,
  visionModel = DEFAULT_ANTHROPIC_VISION_MODEL
} = {}) => {
  let activeTextModel = normalizeConfiguredModel({
    model: textModel,
    defaultModel: DEFAULT_ANTHROPIC_TEXT_MODEL
  })
  let activeVisionModel = normalizeConfiguredModel({
    model: visionModel,
    defaultModel: DEFAULT_ANTHROPIC_VISION_MODEL
  })
  let discoveredModelsPromise = null

  const discoverFallbackModels = async () => {
    if (!discoveredModelsPromise) {
      discoveredModelsPromise = listAnthropicModelIds({ apiKey })
    }
    return discoveredModelsPromise
  }

  const onTextModelFallback = ({ toModel }) => {
    activeTextModel = toModel
  }
  const onVisionModelFallback = ({ toModel }) => {
    activeVisionModel = toModel
  }

  return {
    name: 'anthropic',
    text: {
      get model() {
        return activeTextModel
      },
      generate: async (prompt) => generateText({
        apiKey,
        model: activeTextModel,
        prompt,
        fallbackModels: [DEFAULT_ANTHROPIC_TEXT_MODEL, ...ANTHROPIC_FALLBACK_TEXT_MODELS],
        discoverFallbackModels,
        onModelFallback: onTextModelFallback
      })
    },
    vision: {
      get model() {
        return activeVisionModel
      },
      extract: async ({ prompt, imageBase64, mimeType }) => generateVisionText({
        apiKey,
        model: activeVisionModel,
        prompt,
        imageBase64,
        mimeType,
        fallbackModels: [DEFAULT_ANTHROPIC_VISION_MODEL, ...ANTHROPIC_FALLBACK_VISION_MODELS],
        discoverFallbackModels,
        onModelFallback: onVisionModelFallback
      }),
      extractBatch: async ({ prompt, images }) => generateVisionBatchText({
        apiKey,
        model: activeVisionModel,
        prompt,
        images,
        fallbackModels: [DEFAULT_ANTHROPIC_VISION_MODEL, ...ANTHROPIC_FALLBACK_VISION_MODELS],
        discoverFallbackModels,
        onModelFallback: onVisionModelFallback
      })
    }
  }
}

module.exports = {
  DEFAULT_ANTHROPIC_TEXT_MODEL,
  DEFAULT_ANTHROPIC_VISION_MODEL,
  createAnthropicProvider,
  generateText,
  generateVisionText,
  generateVisionBatchText
}
