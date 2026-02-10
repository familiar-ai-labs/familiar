const test = require('node:test')
const assert = require('node:assert/strict')

const { normalizeExtractorType } = require('../src/screen-stills/stills-markdown-extractor')

test('normalizeExtractorType defaults to local when nothing is configured', () => {
  assert.equal(normalizeExtractorType({}), 'apple_vision_ocr')
  assert.equal(normalizeExtractorType({ stills_markdown_extractor: {} }), 'apple_vision_ocr')
})

test('normalizeExtractorType defaults to cloud when an LLM provider is configured but type is missing', () => {
  assert.equal(
    normalizeExtractorType({
      stills_markdown_extractor: { llm_provider: { provider: 'openai' } }
    }),
    'llm'
  )
  assert.equal(
    normalizeExtractorType({
      stills_markdown_extractor: { llm_provider: { api_key: 'sk-test' } }
    }),
    'llm'
  )
})

test('normalizeExtractorType respects explicit types', () => {
  assert.equal(normalizeExtractorType({ stills_markdown_extractor: { type: 'llm' } }), 'llm')
  assert.equal(normalizeExtractorType({ stills_markdown_extractor: { type: 'cloud' } }), 'llm')
  assert.equal(normalizeExtractorType({ stills_markdown_extractor: { type: 'apple_vision_ocr' } }), 'apple_vision_ocr')
  assert.equal(normalizeExtractorType({ stills_markdown_extractor: { type: 'apple' } }), 'apple_vision_ocr')
})

