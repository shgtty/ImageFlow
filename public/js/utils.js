/**
 * Utility functions for ImageFlow
 */

// ⚡ Bolt Optimization: Cache for getFolderPath to prevent redundant regex/URL parsing
const folderPathCache = new Map();

/**
 * Extracts the folder path from an image URL's 'path' parameter.
 * @param {string} url - The image URL.
 * @param {string} [base] - Optional base URL for parsing relative URLs.
 * @returns {string} The folder path or an empty string.
 */
function getFolderPath(url, base) {
    if (!url) return '';
    const cacheKey = base ? `${url}|${base}` : url;
    if (folderPathCache.has(cacheKey)) return folderPathCache.get(cacheKey);

    try {
        // ⚡ Bolt Optimization: Use fast regex parsing to avoid expensive new URL() constructor overhead in tight loops
        let pathStr = null;
        const match = /[?&]path=([^&#]*)/.exec(url);
        if (match) {
            // URLSearchParams converts '+' to space, simulate this before decoding
            pathStr = decodeURIComponent(match[1].replace(/\+/g, ' '));
        } else {
            const urlObj = new URL(url, base || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost'));
            pathStr = urlObj.searchParams.get('path');
        }

        if (!pathStr) {
            folderPathCache.set(cacheKey, '');
            return '';
        }

        let result = '';
        if (pathStr.includes('|')) {
            const parts = pathStr.split('|');
            const archivePath = parts[0];
            const innerPath = parts[1];
            if (innerPath) {
                const lastSlash = Math.max(innerPath.lastIndexOf('/'), innerPath.lastIndexOf('\\'));
                if (lastSlash >= 0) {
                    result = archivePath + '|' + innerPath.substring(0, lastSlash);
                } else {
                    result = archivePath;
                }
            } else {
                result = archivePath;
            }
        } else {
            const lastSlash = Math.max(pathStr.lastIndexOf('/'), pathStr.lastIndexOf('\\'));
            if (lastSlash >= 0) {
                result = pathStr.substring(0, lastSlash);
            } else {
                result = pathStr;
            }
        }

        // Limit cache size to prevent memory leaks (10k entries is plenty for typical usage)
        if (folderPathCache.size > 10000) folderPathCache.clear();
        folderPathCache.set(cacheKey, result);
        return result;
    } catch (e) {
        return '';
    }
}

/**
 * Gets a display name for the folder from an image URL.
 * @param {string} url - The image URL.
 * @param {string} [base] - Optional base URL for parsing relative URLs.
 * @returns {string} The folder's display name.
 */
function getFolderDisplayName(url, base) {
    let pathStr = getFolderPath(url, base);
    if (!pathStr) return '不明なフォルダ';
    if (pathStr.includes('|')) {
        pathStr = pathStr.split('|')[1] || pathStr.split('|')[0];
    }
    const parts = pathStr.split(/[/\\]/);
    return parts[parts.length - 1] || pathStr;
}

// ⚡ Bolt Optimization: Cache for getFilename to prevent redundant regex/URL parsing
const filenameCache = new Map();

/**
 * Gets the filename from an image URL.
 * @param {string} url - The image URL.
 * @param {string} [base] - Optional base URL for parsing relative URLs.
 * @returns {string} The filename.
 */
function getFilename(url, base) {
    if (!url) return '';
    const cacheKey = base ? `${url}|${base}` : url;
    if (filenameCache.has(cacheKey)) return filenameCache.get(cacheKey);

    try {
        // ⚡ Bolt Optimization: Use fast regex parsing to avoid expensive new URL() constructor overhead in tight loops
        let pathStr = null;
        const match = /[?&]path=([^&#]*)/.exec(url);
        if (match) {
            // URLSearchParams converts '+' to space, simulate this before decoding
            pathStr = decodeURIComponent(match[1].replace(/\+/g, ' '));
        }
        
        if (!pathStr) {
            const urlObj = new URL(url, base || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost'));
            pathStr = urlObj.searchParams.get('path');
            if (!pathStr) {
                pathStr = decodeURIComponent(urlObj.pathname);
            }
        }
        
        if (!pathStr) {
            filenameCache.set(cacheKey, '');
            return '';
        }

        let actualPath = pathStr;
        if (pathStr.includes('|')) {
            actualPath = pathStr.split('|')[1] || pathStr.split('|')[0];
        }

        let result = '';
        const lastSlash = Math.max(actualPath.lastIndexOf('/'), actualPath.lastIndexOf('\\'));
        if (lastSlash >= 0) {
            result = actualPath.substring(lastSlash + 1);
        } else {
            result = actualPath;
        }

        if (filenameCache.size > 10000) filenameCache.clear();
        filenameCache.set(cacheKey, result);
        return result;
    } catch (e) {
        return '';
    }
}

/**
 * Escapes HTML special characters in a string.
 * @param {string} str - The string to escape.
 * @returns {string} The escaped string.
 */
function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

let cachedFolderBoundsIndex = -1;
let cachedFolderBoundsResult = null;
let cachedFolderBoundsUrls = null;

/**
 * Calculates the start and end indices of the folder containing the image at globalIndex.
 * @param {number} globalIndex - The index of the image in the urls array.
 * @param {string[]} urls - The array of image URLs.
 * @returns {object} {start, end, total, relativeIndex}
 */
function getFolderBounds(globalIndex, urls) {
    if (!urls || urls.length === 0 || globalIndex < 0 || globalIndex >= urls.length) {
        return { start: 0, end: 0, total: 0, relativeIndex: 0 };
    }

    // ⚡ Bolt Optimization: Cache O(N) folder bounds calculation to prevent massive UI jank during seekbar updates or rapid navigation
    if (cachedFolderBoundsUrls === urls && cachedFolderBoundsResult &&
        globalIndex >= cachedFolderBoundsResult.start && globalIndex <= cachedFolderBoundsResult.end) {
        return {
            start: cachedFolderBoundsResult.start,
            end: cachedFolderBoundsResult.end,
            total: cachedFolderBoundsResult.total,
            relativeIndex: globalIndex - cachedFolderBoundsResult.start
        };
    }

    const currentFolder = getFolderPath(urls[globalIndex]);
    let start = globalIndex;
    while (start > 0 && getFolderPath(urls[start - 1]) === currentFolder) { start--; }
    let end = globalIndex;
    while (end + 1 < urls.length && getFolderPath(urls[end + 1]) === currentFolder) { end++; }

    const bounds = { start, end, total: end - start + 1, relativeIndex: globalIndex - start };

    cachedFolderBoundsUrls = urls;
    cachedFolderBoundsIndex = globalIndex;
    cachedFolderBoundsResult = { start: bounds.start, end: bounds.end, total: bounds.total };

    return bounds;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getFolderPath, getFolderDisplayName, getFilename, escapeHTML, getFolderBounds };
}
