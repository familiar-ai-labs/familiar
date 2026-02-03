const fs = require('node:fs/promises');
const path = require('node:path');
const { JIMINY_BEHIND_THE_SCENES_DIR_NAME, JIMINY_ANALYSIS_DIR_NAME } = require('../const');
const { createModelProviderClients } = require('../modelProviders');

const buildSummaryPrompt = ({ resultMarkdown }) =>
    'You are summarizing a Markdown result.\n' +
    'Instructions:\n' +
    '- Provide a concise, high-signal summary of the content.\n' +
    '- Focus on key topics, entities, tasks, and decisions.\n' +
    '- Do not copy the full text verbatim.\n' +
    '\n' +
    'Content:\n' +
    resultMarkdown;


const createProviderGenerator = ({ provider, apiKey, model } = {}) => {
    const clients = createModelProviderClients({ provider, apiKey, textModel: model });
    return {
        provider: clients.name,
        model: clients.text.model,
        generate: async (prompt) => clients.text.generate(prompt),
    };
};

const createGeminiGenerator = ({ apiKey, model } = {}) =>
    createProviderGenerator({ provider: 'gemini', apiKey, model });

const createMockGenerator = ({ text = 'gibberish', model = 'mock' } = {}) => ({
    model,
    generate: async () => text,
});

const createAnalysisGenerator = (options = {}) => {
    if (process.env.JIMINY_LLM_MOCK === '1') {
        return createMockGenerator({ text: process.env.JIMINY_LLM_MOCK_TEXT || 'gibberish' });
    }

    return createProviderGenerator(options);
};

const summarizeResult = async ({ resultMarkdown, generator }) => {
    const prompt = buildSummaryPrompt({ resultMarkdown });
    const summary = await generator.generate(prompt);
    return summary.trim();
};

const buildAnalysisFileName = (resultMdPath) => {
    if (!resultMdPath) {
        return 'analysis.md';
    }

    const baseName = path.basename(resultMdPath);
    const parsed = path.parse(baseName);
    const nameWithoutExt = parsed.ext ? parsed.name : parsed.base;
    const extractionSuffix = '-extraction';
    const cleanedName = nameWithoutExt.endsWith(extractionSuffix)
        ? nameWithoutExt.slice(0, -extractionSuffix.length)
        : nameWithoutExt;
    const safeName = cleanedName || 'analysis';

    return `${safeName}-analysis.md`;
};

const resolveAnalysisOutputDir = ({ contextFolderPath, outputDir }) => {
    const rootPath = contextFolderPath;
    if (!rootPath) {
        throw new Error('Context folder path is required to write analysis output.');
    }

    if (outputDir) {
        return { rootPath, outputDir };
    }

    return {
        rootPath,
        outputDir: path.join(rootPath, JIMINY_BEHIND_THE_SCENES_DIR_NAME, JIMINY_ANALYSIS_DIR_NAME),
    };
};

const buildAnalysisMarkdown = ({ resultMdPath, summary, resultMarkdown }) => {
    const trimmedSummary = summary.trim();
    const trimmedContent = (resultMarkdown || '').trim();
    return (
        `Raw result: ${resultMdPath}\n\n` +
        `# Summary\n${trimmedSummary}\n\n` +
        `# Raw Extraction\n${trimmedContent}\n`
    );
};

const writeAnalysisFile = async ({ outputPath, markdown }) => {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    const payload = markdown.endsWith('\n') ? markdown : `${markdown}\n`;
    await fs.writeFile(outputPath, payload, 'utf-8');
    return outputPath;
};

const runAnalysis = async ({
    resultMdPath,
    contextFolderPath,
    provider,
    apiKey,
    model,
    generator,
    summarizeFn,
    outputDir,
} = {}) => {
    if (!resultMdPath) {
        throw new Error('Result markdown path is required for analysis.');
    }

    const resultMarkdown = await fs.readFile(resultMdPath, 'utf-8');
    const resolvedGenerator = generator || createAnalysisGenerator({ provider, apiKey, model });
    const summarize = summarizeFn || summarizeResult;

    const summary = await summarize({ resultMarkdown, generator: resolvedGenerator });
    if (!summary) {
        throw new Error('Analysis summary is empty.');
    }

    const { outputDir: resolvedOutputDir } = resolveAnalysisOutputDir({
        contextFolderPath,
        outputDir,
    });

    const analysisFileName = buildAnalysisFileName(resultMdPath);
    const outputPath = path.join(resolvedOutputDir, analysisFileName);
    const markdown = buildAnalysisMarkdown({ resultMdPath, summary, resultMarkdown });

    await writeAnalysisFile({ outputPath, markdown });

    return {
        outputPath,
        summary,
        relevantNodeId: null,
        relevantNodeName: null,
        outputDir: resolvedOutputDir,
    };
};

module.exports = {
    buildSummaryPrompt,
    createAnalysisGenerator,
    createProviderGenerator,
    createGeminiGenerator,
    createMockGenerator,
    summarizeResult,
    buildAnalysisFileName,
    resolveAnalysisOutputDir,
    buildAnalysisMarkdown,
    writeAnalysisFile,
    runAnalysis,
};
