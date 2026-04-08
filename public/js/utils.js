/**
 * Utility functions for ImageFlow
 */

/**
 * Extracts the folder path from an image URL's 'path' parameter.
 * @param {string} url - The image URL.
 * @param {string} [base] - Optional base URL for parsing relative URLs.
 * @returns {string} The folder path or an empty string.
 */
function getFolderPath(url, base) {
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

        if (!pathStr) return '';

        if (pathStr.includes('|')) {
            return pathStr.split('|')[0];
        }

        const lastSlash = Math.max(pathStr.lastIndexOf('/'), pathStr.lastIndexOf('\\'));
        if (lastSlash >= 0) {
            return pathStr.substring(0, lastSlash);
        }
        return pathStr;
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
    const parts = pathStr.split(/[/\\]/);
    return parts[parts.length - 1] || pathStr;
}

/**
 * Gets the filename from an image URL.
 * @param {string} url - The image URL.
 * @param {string} [base] - Optional base URL for parsing relative URLs.
 * @returns {string} The filename.
 */
function getFilename(url, base) {
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
        
        let actualPath = pathStr;
        if (pathStr.includes('|')) {
            actualPath = pathStr.split('|')[1] || pathStr.split('|')[0];
        }

        const lastSlash = Math.max(actualPath.lastIndexOf('/'), actualPath.lastIndexOf('\\'));
        if (lastSlash >= 0) {
            return actualPath.substring(lastSlash + 1);
        }
        return actualPath;
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

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getFolderPath, getFolderDisplayName, getFilename, escapeHTML };
}
