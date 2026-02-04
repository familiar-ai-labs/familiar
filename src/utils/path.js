const DEFAULT_HOMEBREW_PATHS = ['/opt/homebrew/bin', '/usr/local/bin'];

const ensureHomebrewPath = (options = {}) => {
    const platform = options.platform || process.platform;
    const env = options.env || process.env;
    const logger = options.logger || console;
    const brewPaths = Array.isArray(options.brewPaths) ? options.brewPaths : DEFAULT_HOMEBREW_PATHS;

    if (platform !== 'darwin') {
        return { changed: false, reason: 'non-darwin' };
    }

    const currentPath = typeof env.PATH === 'string' ? env.PATH : '';
    const parts = currentPath.split(':').filter(Boolean);
    const missing = brewPaths.filter((brewPath) => !parts.includes(brewPath));

    if (missing.length === 0) {
        return { changed: false, reason: 'already-present' };
    }

    const nextParts = parts.concat(missing);
    env.PATH = nextParts.join(':');
    logger.log('Added Homebrew paths to PATH', { addedPaths: missing });

    return { changed: true, added: missing, path: env.PATH };
};

module.exports = {
    ensureHomebrewPath,
    DEFAULT_HOMEBREW_PATHS,
};
