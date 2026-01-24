class ExhaustedLlmProviderError extends Error {
  constructor(message = 'LLM provider rate limit exhausted.') {
    super(message)
    this.name = 'ExhaustedLlmProviderError'
    this.code = 'exhaustedLlmProvider'
  }
}

module.exports = {
  ExhaustedLlmProviderError
}
