const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createGeminiSummarizer, DEFAULT_MODEL } = require('../llms');

const loadEnvFromFile = (envPath) => {
    if (!fs.existsSync(envPath)) {
        return;
    }

    const raw = fs.readFileSync(envPath, 'utf-8');
    for (const line of raw.split(/\r?\n/)) {
        if (!line || line.startsWith('#')) {
            continue;
        }

        const separatorIndex = line.indexOf('=');
        if (separatorIndex === -1) {
            continue;
        }

        const key = line.slice(0, separatorIndex).trim();
        if (!key || process.env[key]) {
            continue;
        }

        const value = line.slice(separatorIndex + 1).trim();
        process.env[key] = value.replace(/^"|"$/g, '');
    }
};

const tryLoadEnv = () => {
    const repoRoot = path.join(__dirname, '..', '..');
    const candidates = [
        path.join(repoRoot, '.env'),
        path.join(repoRoot, '.env.local'),
        path.join(__dirname, '..', '.env'),
    ];

    for (const candidate of candidates) {
        loadEnvFromFile(candidate);
    }
};

test('gemini summarizer returns text from provider', async (t) => {
    tryLoadEnv();

    const apiKey = process.env.LLM_API_KEY;
    assert.ok(apiKey, 'LLM_API_KEY must be set to run this test.');

    const summarizer = createGeminiSummarizer({ apiKey, model: DEFAULT_MODEL });
    const summary = await summarizer.summarizeFile({
        relativePath: 'smoke.md',
        content: 'This is a short test file used to verify Gemini summaries.',
    });

    assert.ok(summary);
    assert.ok(summary.length > 0);
});
