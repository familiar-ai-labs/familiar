const { ipcMain } = require('electron');
const { installSkill, getSkillInstallStatus } = require('../skills/installer');

function registerSkillHandlers() {
    ipcMain.handle('skills:install', async (_event, payload) => {
        const harness = payload?.harness || '';
        if (!harness) {
            return { ok: false, message: 'Harness is required.' };
        }

        try {
            console.log('Installing skill', { harness });
            const result = await installSkill({ harness });
            console.log('Skill installed', { harness, path: result.path });
            return { ok: true, path: result.path };
        } catch (error) {
            console.error('Failed to install skill', error);
            return { ok: false, message: 'Failed to install skill.' };
        }
    });

    ipcMain.handle('skills:status', (_event, payload) => {
        const harness = payload?.harness || '';
        if (!harness) {
            return { ok: false, message: 'Harness is required.' };
        }

        try {
            const result = getSkillInstallStatus({ harness });
            return { ok: true, installed: result.installed, path: result.path };
        } catch (error) {
            console.error('Failed to read skill install status', error);
            return { ok: false, message: 'Failed to check skill installation.' };
        }
    });

    console.log('Skill IPC handlers registered');
}

module.exports = {
    registerSkillHandlers,
};
