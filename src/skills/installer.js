const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const HARNESS_SKILL_DIRS = {
    claude: path.join('.claude', 'skills'),
    codex: path.join('.codex', 'skills'),
    cursor: path.join('.cursor', 'skills'),
};

const SKILL_NAME = 'jiminy';

function resolveHarnessSkillPath(harness, options = {}) {
    const baseDir = HARNESS_SKILL_DIRS[harness];
    if (!baseDir) {
        throw new Error(`Unknown harness: ${harness}`);
    }
    const homeDir = options.homeDir || os.homedir();
    if (!homeDir) {
        throw new Error('Unable to resolve home directory');
    }
    return path.join(homeDir, baseDir, SKILL_NAME);
}

function getDefaultSkillSourceDir() {
    return path.join(__dirname, SKILL_NAME);
}

async function installSkill(options = {}) {
    const harness = options.harness;
    if (!harness) {
        throw new Error('Harness is required');
    }
    const sourceDir = options.sourceDir || getDefaultSkillSourceDir();
    const destination = resolveHarnessSkillPath(harness, { homeDir: options.homeDir });
    const destinationRoot = path.dirname(destination);

    await fs.promises.mkdir(destinationRoot, { recursive: true });
    await fs.promises.rm(destination, { recursive: true, force: true });
    await fs.promises.cp(sourceDir, destination, { recursive: true, dereference: true });

    return { path: destination };
}

function getSkillInstallStatus(options = {}) {
    const harness = options.harness;
    if (!harness) {
        throw new Error('Harness is required');
    }
    const destination = resolveHarnessSkillPath(harness, { homeDir: options.homeDir });
    try {
        const stat = fs.statSync(destination);
        return { installed: stat.isDirectory(), path: destination };
    } catch (error) {
        return { installed: false, path: destination };
    }
}

module.exports = {
    resolveHarnessSkillPath,
    getDefaultSkillSourceDir,
    installSkill,
    getSkillInstallStatus,
};
