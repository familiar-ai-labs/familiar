const { withHttpRetry, HttpRetryableError } = require('../utils/retry')

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

class ExhaustedLlmProviderError extends Error {
    constructor(message = 'LLM provider rate limit exhausted.') {
        super(message)
        this.name = 'ExhaustedLlmProviderError'
        this.code = 'exhaustedLlmProvider'
    }
}

const extractTextFromPayload = (payload) => {
    const candidates = payload?.candidates
    if (!Array.isArray(candidates) || candidates.length === 0) {
        return ''
    }

    const parts = candidates[0]?.content?.parts
    if (!Array.isArray(parts) || parts.length === 0) {
        return ''
    }

    return parts.map((part) => part?.text || '').join('')
}

const buildGeminiUrl = ({ model, apiKey }) => `${GEMINI_BASE_URL}/${model}:generateContent?key=${apiKey}`

const logGeminiFailure = ({ context, status, message }) => {
    console.warn(`Gemini ${context} request failed`, { status, message })
}

const requestGemini = async ({
    apiKey,
    model,
    payload,
    context,
    fetchImpl = fetch
} = {}) => {
    if (!apiKey) {
        throw new Error('LLM API key is required for Gemini requests.')
    }

    const url = buildGeminiUrl({ model, apiKey })
    const retryingFetch = withHttpRetry(fetchImpl)

    try {
        const response = await retryingFetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })

        if (!response.ok) {
            const message = await response.text()
            logGeminiFailure({ context, status: response.status, message })
            if (response.status === 429) {
                throw new ExhaustedLlmProviderError()
            }
            throw new Error(`Gemini ${context} request failed: ${response.status} ${message}`)
        }

        return response
    } catch (error) {
        if (error instanceof HttpRetryableError) {
            logGeminiFailure({ context, status: error.status, message: error.message })
            if (error.status === 429) {
                throw new ExhaustedLlmProviderError()
            }
            throw new Error(`Gemini ${context} request failed: ${error.status} ${error.message}`)
        }

        throw error
    }
}

const generateContent = async ({ apiKey, model, prompt, fetchImpl = fetch } = {}) => {
    const response = await requestGemini({
        apiKey,
        model,
        context: 'text',
        fetchImpl,
        payload: {
            contents: [{ parts: [{ text: prompt }] }]
        }
    })

    const payload = await response.json()
    return extractTextFromPayload(payload).trim()
}

const generateVisionContent = async ({
    apiKey,
    model,
    prompt,
    imageBase64,
    mimeType = 'image/png',
    fetchImpl = fetch
} = {}) => {
    if (!apiKey) {
        throw new Error('LLM API key is required for Gemini vision extraction.')
    }

    if (!imageBase64) {
        throw new Error('Image data is required for Gemini vision extraction.')
    }

    const response = await requestGemini({
        apiKey,
        model,
        context: 'vision',
        fetchImpl,
        payload: {
            contents: [
                {
                    role: 'user',
                    parts: [
                        { text: prompt },
                        {
                            inline_data: {
                                mime_type: mimeType,
                                data: imageBase64
                            }
                        }
                    ]
                }
            ]
        }
    })

    const payload = await response.json()
    return extractTextFromPayload(payload).trim()
}

module.exports = {
    ExhaustedLlmProviderError,
    generateContent,
    generateVisionContent
}
