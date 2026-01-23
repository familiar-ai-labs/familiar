// Modules to control application life and create native browser window
const { app, BrowserWindow, Menu, Tray, dialog, nativeImage, ipcMain } = require('electron');
const path = require('node:path');
const { buildTrayMenuTemplate } = require('./menu');
const { loadSettings, saveSettings, validateContextFolderPath } = require('./settings');
const { JsonContextGraphStore, createSummarizer, syncContextGraph } = require('./context-graph');
const { showProviderExhaustedNotification } = require('./notifications');
const { ExhaustedLlmProviderError } = require('./modelProviders');
const { constructContextGraphSkeleton, MAX_NODES } = require('./context-graph/graphSkeleton');
const { registerCaptureHandlers, startCaptureFlow, closeOverlayWindow } = require('./screenshot/capture');
const { registerCaptureHotkey, unregisterGlobalHotkeys } = require('./hotkeys');
const { registerExtractionHandlers } = require('./extraction');
const { registerAnalysisHandlers } = require('./analysis');
const { showWindow } = require('./utils/window');
const trayIconPath = path.join(__dirname, 'icon.png');

let tray = null;
let settingsWindow = null;
let isQuitting = false;
const isE2E = process.env.JIMINY_E2E === '1';
const isCI = process.env.CI === 'true' || process.env.CI === '1';

if (process.platform === 'linux' && (isE2E || isCI)) {
    console.log('Applying Linux CI/E2E Electron flags');
    app.disableHardwareAcceleration();
    app.commandLine.appendSwitch('no-sandbox');
    app.commandLine.appendSwitch('disable-gpu');
    app.commandLine.appendSwitch('disable-dev-shm-usage');
}


function createSettingsWindow() {
    const window = new BrowserWindow({
        width: 520,
        height: 440,
        resizable: false,
        fullscreenable: false,
        minimizable: false,
        show: false,
        title: 'Jiminy Settings',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    window.loadFile('index.html');

    window.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault();
            window.hide();
            console.log('Settings window hidden');
        }
    });

    window.on('closed', () => {
        settingsWindow = null;
    });

    console.log('Settings window created');
    return window;
}

function showSettingsWindow(options = {}) {
    if (!settingsWindow) {
        settingsWindow = createSettingsWindow();
    }

    const result = showWindow(settingsWindow, options);
    const reason = options.reason || result.reason;
    if (result.shown) {
        console.log('Settings window shown', { focus: result.focused, reason });
    } else {
        console.log('Settings window display skipped', { reason });
    }
}

function showAboutDialog() {
    dialog.showMessageBox({
        type: 'info',
        title: 'About Jiminy',
        message: 'Jiminy',
        detail: 'Menu bar app shell (macOS).',
        buttons: ['OK'],
    });
}

function restartApp() {
    console.log('Restarting app');
    app.relaunch();
    app.exit(0);
}

function quitApp() {
    console.log('Quitting app');
    app.quit();
}

function createTray() {
    const trayIconBase = nativeImage.createFromPath(trayIconPath);
    if (trayIconBase.isEmpty()) {
        console.error(`Tray icon failed to load from ${trayIconPath}`);
    }

    const trayIcon = trayIconBase.resize({ width: 16, height: 16 });

    tray = new Tray(trayIcon);
    tray.setToolTip('Jiminy');

    const trayMenu = Menu.buildFromTemplate(
        buildTrayMenuTemplate({
            onCapture: () => {
                void startCaptureFlow();
            },
            onOpenSettings: showSettingsWindow,
            onAbout: showAboutDialog,
            onRestart: restartApp,
            onQuit: quitApp,
        })
    );

    tray.setContextMenu(trayMenu);

    console.log('Tray created');
}

ipcMain.handle('settings:get', () => {
    try {
        const settings = loadSettings();
        const contextFolderPath = settings.contextFolderPath || '';
        const llmProviderName = settings?.llm_provider?.provider || '';
        const llmProviderApiKey = settings?.llm_provider?.api_key || '';
        const exclusions = Array.isArray(settings.exclusions) ? settings.exclusions : [];
        let validationMessage = '';

        if (contextFolderPath) {
            const validation = validateContextFolderPath(contextFolderPath);
            if (!validation.ok) {
                validationMessage = validation.message;
                console.warn('Stored context folder path is invalid', {
                    contextFolderPath,
                    message: validationMessage,
                });
            }
        }

        return { contextFolderPath, validationMessage, llmProviderName, llmProviderApiKey, exclusions };
    } catch (error) {
        console.error('Failed to load settings', error);
        return {
            contextFolderPath: '',
            validationMessage: 'Failed to load settings.',
            llmProviderName: '',
            llmProviderApiKey: '',
            exclusions: []
        };
    }
});
registerCaptureHandlers();
registerExtractionHandlers();
registerAnalysisHandlers();

ipcMain.handle('settings:pickContextFolder', async (event) => {
    if (process.env.JIMINY_E2E === '1' && process.env.JIMINY_E2E_CONTEXT_PATH) {
        const testPath = process.env.JIMINY_E2E_CONTEXT_PATH;
        const validation = validateContextFolderPath(testPath);
        if (!validation.ok) {
            console.warn('E2E mode: invalid context folder path', {
                path: testPath,
                message: validation.message,
            });
            return { canceled: true, error: validation.message };
        }

        console.log('E2E mode: returning context folder path', { path: validation.path });
        return { canceled: false, path: validation.path };
    }

    const parentWindow = BrowserWindow.fromWebContents(event.sender);
    const openDialogOptions = {
        title: 'Select Context Folder',
        properties: ['openDirectory'],
    };

    console.log('Opening context folder picker');
    if (parentWindow) {
        parentWindow.show();
        parentWindow.focus();
    }
    app.focus({ steal: true });

    let result;
    try {
        result = parentWindow
            ? await dialog.showOpenDialog(parentWindow, openDialogOptions)
            : await dialog.showOpenDialog(openDialogOptions);
    } catch (error) {
        console.error('Failed to open context folder picker', error);
        return { canceled: true, error: 'Failed to open folder picker.' };
    }

    if (result.canceled || result.filePaths.length === 0) {
        console.log('Context folder picker canceled');
        return { canceled: true };
    }

    console.log('Context folder selected', { path: result.filePaths[0] });
    return { canceled: false, path: result.filePaths[0] };
});

ipcMain.handle('settings:pickExclusion', async (event, contextFolderPath) => {
    const parentWindow = BrowserWindow.fromWebContents(event.sender);
    const defaultPath = contextFolderPath || undefined;

    const openDialogOptions = {
        title: 'Select File or Folder to Exclude',
        defaultPath,
        properties: ['openFile', 'openDirectory'],
    };

    console.log('Opening exclusion picker', { defaultPath });
    if (parentWindow) {
        parentWindow.show();
        parentWindow.focus();
    }
    app.focus({ steal: true });

    let result;
    try {
        result = parentWindow
            ? await dialog.showOpenDialog(parentWindow, openDialogOptions)
            : await dialog.showOpenDialog(openDialogOptions);
    } catch (error) {
        console.error('Failed to open exclusion picker', error);
        return { canceled: true, error: 'Failed to open picker.' };
    }

    if (result.canceled || result.filePaths.length === 0) {
        console.log('Exclusion picker canceled');
        return { canceled: true };
    }

    const selectedPath = result.filePaths[0];

    // Validate the selected path is inside the context folder
    if (contextFolderPath) {
        const resolvedContext = path.resolve(contextFolderPath);
        const resolvedSelected = path.resolve(selectedPath);
        if (!resolvedSelected.startsWith(resolvedContext + path.sep) && resolvedSelected !== resolvedContext) {
            console.warn('Selected exclusion is outside context folder', { selectedPath, contextFolderPath });
            return { canceled: true, error: 'Selected path must be inside the context folder.' };
        }

        // Return relative path from context folder
        const relativePath = path.relative(resolvedContext, resolvedSelected);
        console.log('Exclusion selected', { absolutePath: selectedPath, relativePath });
        return { canceled: false, path: relativePath };
    }

    console.log('Exclusion selected (no context folder)', { path: selectedPath });
    return { canceled: false, path: selectedPath };
});

ipcMain.handle('settings:save', (event, payload) => {
    const hasContextFolderPath = Object.prototype.hasOwnProperty.call(payload || {}, 'contextFolderPath');
    const hasLlmProviderApiKey = Object.prototype.hasOwnProperty.call(payload || {}, 'llmProviderApiKey');
    const hasLlmProviderName = Object.prototype.hasOwnProperty.call(payload || {}, 'llmProviderName');
    const hasExclusions = Object.prototype.hasOwnProperty.call(payload || {}, 'exclusions');
    const settingsPayload = {};

    if (!hasContextFolderPath && !hasLlmProviderApiKey && !hasLlmProviderName && !hasExclusions) {
        return { ok: false, message: 'No settings provided.' };
    }

    if (hasContextFolderPath) {
        const contextFolderPath = payload?.contextFolderPath || '';
        const validation = validateContextFolderPath(contextFolderPath);

        if (!validation.ok) {
            console.warn('Context folder validation failed', {
                contextFolderPath,
                message: validation.message,
            });
            return { ok: false, message: validation.message };
        }

        settingsPayload.contextFolderPath = validation.path;
    }

    if (hasLlmProviderApiKey) {
        settingsPayload.llmProviderApiKey = typeof payload.llmProviderApiKey === 'string'
            ? payload.llmProviderApiKey
            : '';
    }

    if (hasLlmProviderName) {
        settingsPayload.llmProviderName = typeof payload.llmProviderName === 'string'
            ? payload.llmProviderName
            : '';
    }

    if (hasExclusions) {
        settingsPayload.exclusions = Array.isArray(payload.exclusions) ? payload.exclusions : [];
    }

    try {
        saveSettings(settingsPayload);
        console.log('Settings saved');
        return { ok: true };
    } catch (error) {
        console.error('Failed to save settings', error);
        return { ok: false, message: 'Failed to save settings.' };
    }
});

ipcMain.handle('contextGraph:sync', async (event) => {
    const settings = loadSettings();
    const contextFolderPath = settings.contextFolderPath || '';
    const llmProviderName = settings?.llm_provider?.provider || '';
    const llmProviderApiKey = settings?.llm_provider?.api_key || '';
    const textModel = typeof settings?.llm_provider?.text_model === 'string' && settings.llm_provider.text_model.trim()
        ? settings.llm_provider.text_model
        : undefined;
    const exclusions = Array.isArray(settings.exclusions) ? settings.exclusions : [];
    const validation = validateContextFolderPath(contextFolderPath);

    if (!validation.ok) {
        console.warn('Context graph sync failed validation', { message: validation.message });
        return { ok: false, message: validation.message };
    }

    try {
        if (!llmProviderName) {
            return { ok: false, message: 'LLM provider is not configured. Set it in Settings.' };
        }
        if (process.env.JIMINY_LLM_MOCK !== '1' && !llmProviderApiKey) {
            return { ok: false, message: 'LLM API key is not configured. Set it in Settings.' };
        }

        const store = new JsonContextGraphStore({ contextFolderPath: validation.path });
        const summarizer = createSummarizer({
            provider: llmProviderName,
            apiKey: llmProviderApiKey,
            textModel
        });
        const result = await syncContextGraph({
            rootPath: validation.path,
            store,
            summarizer,
            exclusions,
            onProgress: (progress) => {
                event.sender.send('contextGraph:progress', progress);
            },
        });

        return {
            ok: true,
            graphPath: store.getPath(),
            counts: result.graph.counts,
            errors: result.errors,
            warnings: result.warnings,
        };
    } catch (error) {
        console.error('Context graph sync failed', error);
        if (error instanceof ExhaustedLlmProviderError) {
            showProviderExhaustedNotification({ source: 'context_graph_sync' });
            return { ok: false, message: 'LLM provider rate limit exhausted. Please try again later.' };
        }
        return { ok: false, message: error.message || 'Failed to sync context graph.' };
    }
});

ipcMain.handle('contextGraph:prune', () => {
    const settings = loadSettings();
    const contextFolderPath = settings.contextFolderPath || '';
    if (!contextFolderPath) {
        console.warn('Context graph prune skipped: missing context folder path');
        return { ok: true, deleted: false, graphPath: null };
    }

    const validation = validateContextFolderPath(contextFolderPath);
    if (!validation.ok) {
        console.warn('Context graph prune skipped: invalid context folder path', { message: validation.message });
        return { ok: true, deleted: false, graphPath: null };
    }

    const store = new JsonContextGraphStore({ contextFolderPath: validation.path });
    const graphPath = store.getPath();

    console.log('Pruning context graph', { path: graphPath });

    try {
        const result = store.delete();
        if (result.deleted) {
            console.log('Context graph pruned', { path: graphPath });
        } else {
            console.log('Context graph file not found', { path: graphPath });
        }
        return { ok: true, deleted: result.deleted, graphPath };
    } catch (error) {
        console.error('Failed to prune context graph', error);
        return { ok: false, message: error.message || 'Failed to prune context graph.' };
    }
});

/**
 * Computes sync stats by comparing stored graph nodes to current scan nodes.
 * @param {Object|null} storedGraph - The previously saved graph
 * @param {Object} scanResult - The result from constructContextGraphSkeleton
 * @returns {{ synced: number, outOfSync: number, new: number, total: number }}
 */
const computeSyncStats = (storedGraph, scanResult) => {
    const storedNodes = storedGraph?.nodes || {};
    const currentNodes = scanResult.nodes || {};
    const total = scanResult.counts.files + scanResult.counts.folders;

    let synced = 0;
    let outOfSync = 0;
    let newNodes = 0;

    for (const nodeId of Object.keys(currentNodes)) {
        const currentNode = currentNodes[nodeId];
        const storedNode = storedNodes[nodeId];

        if (!storedNode) {
            // Node doesn't exist in stored graph - it's new
            newNodes += 1;
        } else if (
            currentNode.contentHash &&
            storedNode.contentHash &&
            currentNode.contentHash === storedNode.contentHash
        ) {
            // Hash matches - synced
            synced += 1;
        } else {
            // Hash differs or missing - out of sync
            outOfSync += 1;
        }
    }

    return { synced, outOfSync, new: newNodes, total };
};

const parseMaxNodesError = (error) => {
    const message = error?.message || '';
    const match = /Context graph has (\d+) nodes, exceeding MAX_NODES/.exec(message);
    if (!match) {
        return { maxNodesExceeded: false, totalNodes: 0 };
    }

    return {
        maxNodesExceeded: true,
        totalNodes: Number(match[1])
    };
};

ipcMain.handle('contextGraph:status', async (_event, payload = {}) => {
    const settings = loadSettings();
    const contextFolderPath = typeof payload?.contextFolderPath === 'string'
        ? payload.contextFolderPath
        : settings.contextFolderPath || '';
    const exclusions = Array.isArray(payload?.exclusions)
        ? payload.exclusions
        : Array.isArray(settings.exclusions)
            ? settings.exclusions
            : [];

    if (!contextFolderPath) {
        return {
            ok: true,
            syncedNodes: 0,
            outOfSyncNodes: 0,
            newNodes: 0,
            totalNodes: 0,
            maxNodesExceeded: false
        };
    }

    const validation = validateContextFolderPath(contextFolderPath);
    if (!validation.ok) {
        return {
            ok: true,
            syncedNodes: 0,
            outOfSyncNodes: 0,
            newNodes: 0,
            totalNodes: 0,
            maxNodesExceeded: false
        };
    }

    const store = new JsonContextGraphStore({ contextFolderPath: validation.path });
    const storedGraph = store.load();
    const effectiveExclusions = Array.from(new Set(exclusions.filter(Boolean)));

    try {
        const scanResult = constructContextGraphSkeleton(validation.path, {
            maxNodes: MAX_NODES,
            exclusions: effectiveExclusions,
            logger: console,
        });

        const stats = computeSyncStats(storedGraph, scanResult);
        return {
            ok: true,
            syncedNodes: stats.synced,
            outOfSyncNodes: stats.outOfSync,
            newNodes: stats.new,
            totalNodes: stats.total,
            maxNodesExceeded: false
        };
    } catch (error) {
        const maxNodes = parseMaxNodesError(error);
        if (maxNodes.maxNodesExceeded) {
            return {
                ok: false,
                syncedNodes: 0,
                outOfSyncNodes: 0,
                newNodes: 0,
                totalNodes: maxNodes.totalNodes,
                maxNodesExceeded: true,
                message: error.message || `Context graph exceeds MAX_NODES (${MAX_NODES}).`,
            };
        }

        console.error('Failed to compute context graph status', error);
        return {
            ok: false,
            syncedNodes: 0,
            outOfSyncNodes: 0,
            newNodes: 0,
            totalNodes: 0,
            maxNodesExceeded: false,
            message: error.message || 'Failed to check context graph status.',
        };
    }
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
    if (process.platform !== 'darwin' && !isE2E) {
        console.error('Jiminy desktop app is macOS-only right now.');
        app.quit();
        return;
    }

    if (process.platform === 'darwin') {
        if (app.dock) {
    app.dock.hide();
        }
    app.setLoginItemSettings({ openAtLogin: true, openAsHidden: true });

    createTray();
    const hotkeyResult = registerCaptureHotkey({
        onCapture: () => {
            void startCaptureFlow();
        },
    });
    if (!hotkeyResult.ok) {
        console.warn('Capture hotkey inactive', { reason: hotkeyResult.reason, accelerator: hotkeyResult.accelerator });
    }
    } else if (isE2E) {
        console.log('E2E mode: running on non-macOS platform');
    }

    if (isE2E) {
        console.log('E2E mode: opening settings window');
        showSettingsWindow({ focus: false, reason: 'e2e' });
    }

    app.on('activate', () => {
        // Keep background-only behavior; open Settings only from the tray menu.
    });
});

app.on('before-quit', () => {
    isQuitting = true;
    unregisterGlobalHotkeys();
    closeOverlayWindow();
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught exception in main process', error);
});

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection in main process', reason);
});

app.on('render-process-gone', (_event, details) => {
    console.error('Renderer process gone', details);
});

app.on('window-all-closed', (event) => {
    if (process.platform === 'darwin') {
        event.preventDefault();
        console.log("preventing app from exiting when all windows are closed")
        return;
    }

    if (!isE2E) {
        app.quit();
    }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
