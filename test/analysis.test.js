const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')

const { JIMINY_BEHIND_THE_SCENES_DIR_NAME, JIMINY_ANALYSIS_DIR_NAME } = require('../src/const')
const { runAnalysis } = require('../src/analysis')

const makeTempDir = async (prefix) => fs.mkdtemp(path.join(os.tmpdir(), prefix))

test('analysis writes summary to jiminy analysis folder by default', async () => {
  const contextRoot = await makeTempDir('jiminy-context-')
  const extractionDir = await makeTempDir('jiminy-extraction-')
  const extractionPath = path.join(extractionDir, 'capture-extraction.md')
  const rawExtractionContent = 'Extraction content'
  await fs.writeFile(extractionPath, rawExtractionContent, 'utf-8')

  const result = await runAnalysis({
    resultMdPath: extractionPath,
    contextFolderPath: contextRoot,
    generator: { model: 'mock', generate: async () => 'mock' },
    summarizeFn: async () => 'Summary of extraction.'
  })

  const expectedFile = path.join(
    contextRoot,
    JIMINY_BEHIND_THE_SCENES_DIR_NAME,
    JIMINY_ANALYSIS_DIR_NAME,
    'capture-analysis.md'
  )

  assert.equal(result.outputPath, expectedFile)
  assert.equal(result.relevantNodeName, null)
  assert.ok(await fs.stat(result.outputPath))

  const writtenContent = await fs.readFile(result.outputPath, 'utf-8')
  assert.ok(writtenContent.includes('# Summary'), 'should contain summary heading')
  assert.ok(writtenContent.includes('Summary of extraction.'), 'should contain summary text')
  assert.ok(writtenContent.includes('# Raw Extraction'), 'should contain raw extraction heading')
  assert.ok(writtenContent.includes(rawExtractionContent), 'should contain raw extraction content')
})

test('analysis writes summary to provided output directory', async () => {
  const contextRoot = await makeTempDir('jiminy-context-')
  const extractionDir = await makeTempDir('jiminy-extraction-')
  const extractionPath = path.join(extractionDir, 'capture-extraction.md')
  const rawExtractionContent = 'Extraction content'
  await fs.writeFile(extractionPath, rawExtractionContent, 'utf-8')

  const outputDir = path.join(
    contextRoot,
    JIMINY_BEHIND_THE_SCENES_DIR_NAME,
    JIMINY_ANALYSIS_DIR_NAME
  )

  const result = await runAnalysis({
    resultMdPath: extractionPath,
    contextFolderPath: contextRoot,
    generator: { model: 'mock', generate: async () => 'mock' },
    summarizeFn: async () => 'Summary of extraction.',
    outputDir
  })

  const expectedFile = path.join(outputDir, 'capture-analysis.md')

  assert.equal(result.outputPath, expectedFile)
  assert.equal(result.relevantNodeName, null)
  assert.ok(await fs.stat(result.outputPath))

  const writtenContent = await fs.readFile(result.outputPath, 'utf-8')
  assert.ok(writtenContent.includes('# Summary'), 'should contain summary heading')
  assert.ok(writtenContent.includes('Summary of extraction.'), 'should contain summary text')
  assert.ok(writtenContent.includes('# Raw Extraction'), 'should contain raw extraction heading')
  assert.ok(writtenContent.includes(rawExtractionContent), 'should contain raw extraction content')
})
