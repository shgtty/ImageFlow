const path = require('path');

/**
 * Checks if a target path is inside a base directory.
 * @param {string} baseDir - The allowed base directory.
 * @param {string} targetPath - The path to check.
 * @returns {boolean} True if the target path is inside the base directory.
 */
function isPathInside(baseDir, targetPath) {
    const resolvedBase = path.resolve(baseDir);
    const resolvedTarget = path.resolve(targetPath);
    const base = resolvedBase.endsWith(path.sep) ? resolvedBase : resolvedBase + path.sep;
    return resolvedTarget === resolvedBase || resolvedTarget.startsWith(base);
}

module.exports = {
    isPathInside
};
