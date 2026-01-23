const { generateContent, ExhaustedLlmProviderError } = require('./modelProviders/gemini');

const DEFAULT_MODEL = 'gemini-2.0-flash-lite';

const buildFilePrompt = ({ relativePath, content }) =>
    `Summarize the following file for a context index.\n` +
    `File: ${relativePath}\n` +
    `Instructions: Provide a concise, high-signal summary that captures the purpose, key facts, and decisions. ` +
    `Avoid fluff. Write in plain sentences.\n\n` +
    `Content:\n${content}`;

const buildFolderPrompt = ({ relativePath, summaries }) =>
    `Summarize the contents of this folder using the file summaries below.\n` +
    `Folder: ${relativePath || '.'}\n` +
    `Instructions: Provide a concise overview of the folder's themes, key artifacts, and how the files relate. ` +
    `Avoid repeating every file name.\n\n` +
    `File summaries:\n${summaries}`;

const createGeminiSummarizer = ({ apiKey, model = DEFAULT_MODEL } = {}) => ({
    model,
    summarizeFile: async ({ relativePath, content }) =>
        generateContent({
            apiKey,
            model,
            prompt: buildFilePrompt({ relativePath, content }),
        }),
    summarizeFolder: async ({ relativePath, summaries }) =>
        generateContent({
            apiKey,
            model,
            prompt: buildFolderPrompt({ relativePath, summaries }),
        }),
});

const createMockSummarizer = ({ text = 'gibberish', model = 'mock' } = {}) => ({
    model,
    summarizeFile: async () => text,
    summarizeFolder: async () => text,
});

const createSummarizer = (options = {}) => {
    if (process.env.JIMINY_LLM_MOCK === '1') {
        return createMockSummarizer({ text: process.env.JIMINY_LLM_MOCK_TEXT || 'gibberish' });
    }

    return createGeminiSummarizer(options);
};

module.exports = {
    DEFAULT_MODEL,
    ExhaustedLlmProviderError,
    createGeminiSummarizer,
    createMockSummarizer,
    createSummarizer,
};
