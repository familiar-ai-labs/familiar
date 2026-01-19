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

const extractText = (payload) => {
    const candidates = payload?.candidates;
    if (!Array.isArray(candidates) || candidates.length === 0) {
        return '';
    }

    const parts = candidates[0]?.content?.parts;
    if (!Array.isArray(parts) || parts.length === 0) {
        return '';
    }

    return parts.map((part) => part?.text || '').join('');
};

const generateContent = async ({ apiKey, model, prompt }) => {
    if (!apiKey) {
        throw new Error('LLM_API_KEY is required for Gemini summaries.');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
        }),
    });

    if (!response.ok) {
        const message = await response.text();
        throw new Error(`Gemini request failed: ${response.status} ${message}`);
    }

    const payload = await response.json();
    return extractText(payload).trim();
};

const createGeminiSummarizer = ({ apiKey = process.env.LLM_API_KEY, model = DEFAULT_MODEL } = {}) => ({
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
    createGeminiSummarizer,
    createMockSummarizer,
    createSummarizer,
};
