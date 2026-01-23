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

const generateContent = async ({ apiKey, model, prompt, fetchImpl = fetch } = {}) => {
    if (!apiKey) {
        throw new Error('LLM API key is required for Gemini summaries.')
    }

    const url = buildGeminiUrl({ model, apiKey })
    const response = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
        })
    })

    if (response.status === 429) {
        const message = await response.text()
        logGeminiFailure({ context: 'text', status: response.status, message })
        throw new ExhaustedLlmProviderError()
    }

    if (!response.ok) {
        const message = await response.text()
        logGeminiFailure({ context: 'text', status: response.status, message })
        throw new Error(`Gemini request failed: ${response.status} ${message}`)
    }

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

    const url = buildGeminiUrl({ model, apiKey })
    const response = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        })
    })

    if (response.status === 429) {
        const message = await response.text()
        logGeminiFailure({ context: 'vision', status: response.status, message })
        throw new ExhaustedLlmProviderError()
    }

    if (!response.ok) {
        const message = await response.text()
        logGeminiFailure({ context: 'vision', status: response.status, message })
        throw new Error(`Gemini vision request failed: ${response.status} ${message}`)
    }

    const payload = await response.json()
    return extractTextFromPayload(payload).trim()
}

module.exports = {
    ExhaustedLlmProviderError,
    generateContent,
    generateVisionContent
}
