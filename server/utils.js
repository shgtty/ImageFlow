const path = require('path');

// ⚡ Bolt Optimization: Cache resolved paths to prevent expensive process.cwd() and string manipulation in hot loops (e.g. /image endpoint)
const resolveCache = new Map();

function getResolvedPath(p) {
    if (resolveCache.has(p)) return resolveCache.get(p);
    const resolved = path.resolve(p);

    // Prevent memory leaks for long-running processes
    if (resolveCache.size > 10000) resolveCache.clear();

    resolveCache.set(p, resolved);
    return resolved;
}

/**
 * Checks if a target path is inside a base directory.
 * @param {string} baseDir - The allowed base directory.
 * @param {string} targetPath - The path to check.
 * @returns {boolean} True if the target path is inside the base directory.
 */
function isPathInside(baseDir, targetPath) {
    const resolvedBase = getResolvedPath(baseDir);
    const resolvedTarget = getResolvedPath(targetPath);
    const base = resolvedBase.endsWith(path.sep) ? resolvedBase : resolvedBase + path.sep;
    return resolvedTarget === resolvedBase || resolvedTarget.startsWith(base);
}

module.exports = {
    isPathInside,
    getResolvedPath
};
