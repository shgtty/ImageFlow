const test = require('node:test');
const assert = require('node:assert');
const { getFolderPath, getFolderDisplayName, getFilename } = require('../public/js/utils.js');

const BASE_URL = 'http://localhost';

test('getFolderPath utility', async (t) => {
    await t.test('extracts folder path from a simple URL', () => {
        const url = `${BASE_URL}/image?path=C:\\Photos\\img.jpg`;
        assert.strictEqual(getFolderPath(url, BASE_URL), 'C:\\Photos');
    });

    await t.test('extracts folder path from a ZIP entry URL', () => {
        const url = `${BASE_URL}/image?path=C:\\Archive.zip|photo.jpg`;
        assert.strictEqual(getFolderPath(url, BASE_URL), 'C:\\Archive.zip');
    });

    await t.test('handles Unix-style paths', () => {
        const url = `${BASE_URL}/image?path=/home/user/pictures/cat.png`;
        assert.strictEqual(getFolderPath(url, BASE_URL), '/home/user/pictures');
    });

    await t.test('returns empty string if path parameter is missing', () => {
        const url = `${BASE_URL}/image?other=value`;
        assert.strictEqual(getFolderPath(url, BASE_URL), '');
    });

    await t.test('returns full path if no slashes are present', () => {
        const url = `${BASE_URL}/image?path=filename.jpg`;
        assert.strictEqual(getFolderPath(url, BASE_URL), 'filename.jpg');
    });

    await t.test('handles trailing slashes (though unlikely in this app)', () => {
        const url = `${BASE_URL}/image?path=C:\\Photos\\`;
        assert.strictEqual(getFolderPath(url, BASE_URL), 'C:\\Photos');
    });

    await t.test('handles invalid URLs gracefully', () => {
        assert.strictEqual(getFolderPath('not-a-url'), '');
    });
});

test('getFolderDisplayName utility', async (t) => {
    await t.test('gets last part of Windows path', () => {
        const url = `${BASE_URL}/image?path=C:\\Photos\\Summer\\img.jpg`;
        assert.strictEqual(getFolderDisplayName(url, BASE_URL), 'Summer');
    });

    await t.test('gets last part of Unix path', () => {
        const url = `${BASE_URL}/image?path=/home/user/pictures/vacation/beach.png`;
        assert.strictEqual(getFolderDisplayName(url, BASE_URL), 'vacation');
    });

    await t.test('handles ZIP archive display name', () => {
        // According to current implementation, it returns the full path of the ZIP if it's the folder path
        const url = `${BASE_URL}/image?path=C:\\Archive.zip|photo.jpg`;
        assert.strictEqual(getFolderDisplayName(url, BASE_URL), 'Archive.zip');
    });

    await t.test('returns default message if no path', () => {
        const url = `${BASE_URL}/image`;
        assert.strictEqual(getFolderDisplayName(url, BASE_URL), '不明なフォルダ');
    });

    await t.test('handles root level file', () => {
        const url = `${BASE_URL}/image?path=C:\\image.jpg`;
        assert.strictEqual(getFolderDisplayName(url, BASE_URL), 'C:');
    });
});

test('getFilename utility', async (t) => {
    await t.test('extracts filename from Windows path', () => {
        const url = `${BASE_URL}/image?path=C:\\Photos\\img.jpg`;
        assert.strictEqual(getFilename(url, BASE_URL), 'img.jpg');
    });

    await t.test('extracts filename from Unix path', () => {
        const url = `${BASE_URL}/image?path=/home/user/pictures/cat.png`;
        assert.strictEqual(getFilename(url, BASE_URL), 'cat.png');
    });

    await t.test('extracts filename from ZIP entry', () => {
        const url = `${BASE_URL}/image?path=C:\\Archive.zip|vacation/beach.png`;
        assert.strictEqual(getFilename(url, BASE_URL), 'beach.png');
    });

    await t.test('extracts filename from ZIP entry (no internal folder)', () => {
        const url = `${BASE_URL}/image?path=C:\\Archive.zip|photo.jpg`;
        assert.strictEqual(getFilename(url, BASE_URL), 'photo.jpg');
    });

    await t.test('falls back to pathname if path parameter is missing', () => {
        const url = `${BASE_URL}/assets/logo.svg`;
        assert.strictEqual(getFilename(url, BASE_URL), 'logo.svg');
    });

    await t.test('handles filenames with no slashes', () => {
        const url = `${BASE_URL}/image?path=justname.jpg`;
        assert.strictEqual(getFilename(url, BASE_URL), 'justname.jpg');
    });

    await t.test('handles empty or missing input', () => {
        const url = `${BASE_URL}/image?path=`;
        assert.strictEqual(getFilename(url, BASE_URL), 'image'); // urlObj.pathname is '/image'
    });

    await t.test('handles invalid URLs gracefully', () => {
        assert.strictEqual(getFilename('://'), '');
    });
});
