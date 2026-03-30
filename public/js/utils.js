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
        const urlObj = new URL(url, base || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost'));
        const pathStr = urlObj.searchParams.get('path');
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

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getFolderPath, getFolderDisplayName };
}
