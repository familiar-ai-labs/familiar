const assert = require('node:assert/strict');
const { test } = require('node:test');

const { createModelProviderClients } = require('../src/modelProviders');

const createOkResponse = (payload) => ({
    ok: true,
    status: 200,
    json: async () => payload,
    text: async () => '',
});

const createErrorResponse = ({ status, message }) => ({
    ok: false,
    status,
    json: async () => ({}),
    text: async () => message,
});

test('openai provider generates text from chat completions', async () => {
    let capturedPayload = null;
    const originalFetch = global.fetch;
    global.fetch = async (_url, options) => {
        capturedPayload = JSON.parse(options.body);
        return createOkResponse({
            choices: [{ message: { content: 'openai summary' } }],
        });
    };

    try {
        const provider = createModelProviderClients({ provider: 'openai', apiKey: 'test-key' });
        const result = await provider.text.generate('Summarize this file.');

        assert.equal(result, 'openai summary');
        assert.equal(capturedPayload.model, 'gpt-4o-mini');
        assert.equal(capturedPayload.messages[0].role, 'user');
    } finally {
        global.fetch = originalFetch;
    }
});

test('anthropic provider generates vision text', async () => {
    let capturedPayload = null;
    const originalFetch = global.fetch;
    global.fetch = async (_url, options) => {
        capturedPayload = JSON.parse(options.body);
        return createOkResponse({
            content: [{ type: 'text', text: 'anthropic extraction' }],
        });
    };

    try {
        const provider = createModelProviderClients({ provider: 'anthropic', apiKey: 'test-key' });
        const result = await provider.vision.extract({
            prompt: 'Extract text.',
            imageBase64: 'ZmFrZQ==',
            mimeType: 'image/png',
        });

        assert.equal(result, 'anthropic extraction');
        assert.equal(capturedPayload.model, 'claude-haiku-4-5');
        assert.equal(capturedPayload.messages[0].content[0].type, 'text');
        assert.equal(capturedPayload.messages[0].content[1].type, 'image');
    } finally {
        global.fetch = originalFetch;
    }
});

test('anthropic provider falls back across known models when requested model is missing', async () => {
    const capturedModels = [];
    const originalFetch = global.fetch;
    global.fetch = async (_url, options) => {
        const payload = JSON.parse(options.body);
        capturedModels.push(payload.model);

        if (capturedModels.length <= 2) {
            return createErrorResponse({
                status: 404,
                message: JSON.stringify({
                    type: 'error',
                    error: {
                        type: 'not_found_error',
                        message: `model: ${payload.model}`
                    }
                })
            });
        }

        return createOkResponse({
            content: [{ type: 'text', text: 'fallback extraction' }],
        });
    };

    try {
        const provider = createModelProviderClients({
            provider: 'anthropic',
            apiKey: 'test-key',
            visionModel: 'claude-totally-missing-custom-model',
        });
        const result = await provider.vision.extract({
            prompt: 'Extract text.',
            imageBase64: 'ZmFrZQ==',
            mimeType: 'image/png',
        });

        assert.equal(result, 'fallback extraction');
        assert.deepEqual(capturedModels, [
            'claude-totally-missing-custom-model',
            'claude-haiku-4-5',
            'claude-haiku-4-5-20251001'
        ]);
        assert.equal(provider.vision.model, 'claude-haiku-4-5-20251001');
    } finally {
        global.fetch = originalFetch;
    }
});

test('anthropic provider remaps retired configured model to default haiku before first request', async () => {
    const capturedModels = [];
    const originalFetch = global.fetch;
    global.fetch = async (_url, options) => {
        const payload = JSON.parse(options.body);
        capturedModels.push(payload.model);
        return createOkResponse({
            content: [{ type: 'text', text: 'mapped extraction' }],
        });
    };

    try {
        const provider = createModelProviderClients({
            provider: 'anthropic',
            apiKey: 'test-key',
            visionModel: 'claude-3-5-sonnet-20240620',
        });
        const result = await provider.vision.extract({
            prompt: 'Extract text.',
            imageBase64: 'ZmFrZQ==',
            mimeType: 'image/png',
        });

        assert.equal(result, 'mapped extraction');
        assert.deepEqual(capturedModels, ['claude-haiku-4-5']);
        assert.equal(provider.vision.model, 'claude-haiku-4-5');
    } finally {
        global.fetch = originalFetch;
    }
});

test('anthropic provider discovers available account models when built-in fallbacks are missing', async () => {
    const capturedMessageModels = [];
    let modelsEndpointCalls = 0;
    const originalFetch = global.fetch;
    global.fetch = async (url, options) => {
        if (typeof url === 'string' && url.endsWith('/models')) {
            modelsEndpointCalls += 1;
            return createOkResponse({
                data: [
                    { id: 'claude-account-vision-model' },
                ],
            });
        }

        const payload = JSON.parse(options.body);
        capturedMessageModels.push(payload.model);
        if (payload.model === 'claude-account-vision-model') {
            return createOkResponse({
                content: [{ type: 'text', text: 'account model extraction' }],
            });
        }

        return createErrorResponse({
            status: 404,
            message: JSON.stringify({
                type: 'error',
                error: {
                    type: 'not_found_error',
                    message: `model: ${payload.model}`
                }
            })
        });
    };

    try {
        const provider = createModelProviderClients({
            provider: 'anthropic',
            apiKey: 'test-key',
            visionModel: 'claude-non-existent-initial'
        });

        const result = await provider.vision.extract({
            prompt: 'Extract text.',
            imageBase64: 'ZmFrZQ==',
            mimeType: 'image/png',
        });

        assert.equal(result, 'account model extraction');
        assert.equal(modelsEndpointCalls, 1);
        assert.equal(capturedMessageModels[capturedMessageModels.length - 1], 'claude-account-vision-model');
        assert.equal(provider.vision.model, 'claude-account-vision-model');
    } finally {
        global.fetch = originalFetch;
    }
});
