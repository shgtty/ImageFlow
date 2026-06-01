const test = require('node:test');
const assert = require('node:assert');
const { getFolderPath, getFolderDisplayName, getFilename, escapeHTML, getFolderBounds, isVideoUrl } = require('../public/js/utils.js');

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

    await t.test('handles malformed percent-encoding in path parameter', () => {
        // %E0%A0 is an incomplete UTF-8 sequence and should cause URIError in decodeURIComponent
        const url = `${BASE_URL}/image?path=%E0%A0`;
        assert.strictEqual(getFolderPath(url, BASE_URL), '');
    });

    await t.test('handles completely invalid URLs (e.g., ://)', () => {
        // This should trigger the catch block via the URL constructor
        assert.strictEqual(getFolderPath('://'), '');
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

test('escapeHTML utility', async (t) => {
    await t.test('escapes HTML special characters', () => {
        assert.strictEqual(escapeHTML('&'), '&amp;');
        assert.strictEqual(escapeHTML('<'), '&lt;');
        assert.strictEqual(escapeHTML('>'), '&gt;');
        assert.strictEqual(escapeHTML('"'), '&quot;');
        assert.strictEqual(escapeHTML("'"), '&#39;');
    });

    await t.test('returns same string if no special characters', () => {
        assert.strictEqual(escapeHTML('hello world'), 'hello world');
    });

    await t.test('handles empty or falsy inputs', () => {
        assert.strictEqual(escapeHTML(''), '');
        assert.strictEqual(escapeHTML(null), '');
        assert.strictEqual(escapeHTML(undefined), '');
        assert.strictEqual(escapeHTML(0), '');
        assert.strictEqual(escapeHTML(false), '');
    });

    await t.test('escapes multiple characters in a string', () => {
        const input = '<div class="test">Fish & Chips</div>';
        const expected = '&lt;div class=&quot;test&quot;&gt;Fish &amp; Chips&lt;/div&gt;';
        assert.strictEqual(escapeHTML(input), expected);
    });

    await t.test('handles non-string inputs', () => {
        assert.strictEqual(escapeHTML(123), '123');
        assert.strictEqual(escapeHTML(true), 'true');
    });
});

test('getFolderBounds utility', async (t) => {
    const urls = [
        'http://localhost/image?path=C:\\folder1\\img1.jpg',
        'http://localhost/image?path=C:\\folder1\\img2.jpg',
        'http://localhost/image?path=C:\\folder2\\img3.jpg',
        'http://localhost/image?path=C:\\folder2\\img4.jpg',
        'http://localhost/image?path=C:\\folder2\\img5.jpg',
    ];

    await t.test('handles invalid inputs', () => {
        const expected = { start: 0, end: 0, total: 0, relativeIndex: 0 };
        assert.deepStrictEqual(getFolderBounds(-1, urls), expected);
        assert.deepStrictEqual(getFolderBounds(5, urls), expected);
        assert.deepStrictEqual(getFolderBounds(0, null), expected);
        assert.deepStrictEqual(getFolderBounds(0, []), expected);
    });

    await t.test('calculates bounds for single folder', () => {
        const singleFolderUrls = [urls[0], urls[1]];
        const expected = { start: 0, end: 1, total: 2, relativeIndex: 0 };
        assert.deepStrictEqual(getFolderBounds(0, singleFolderUrls), expected);

        const expectedLast = { start: 0, end: 1, total: 2, relativeIndex: 1 };
        assert.deepStrictEqual(getFolderBounds(1, singleFolderUrls), expectedLast);
    });

    await t.test('calculates bounds for multiple folders', () => {
        // folder1: [0, 1]
        assert.deepStrictEqual(getFolderBounds(0, urls), { start: 0, end: 1, total: 2, relativeIndex: 0 });
        assert.deepStrictEqual(getFolderBounds(1, urls), { start: 0, end: 1, total: 2, relativeIndex: 1 });

        // folder2: [2, 4]
        assert.deepStrictEqual(getFolderBounds(2, urls), { start: 2, end: 4, total: 3, relativeIndex: 0 });
        assert.deepStrictEqual(getFolderBounds(3, urls), { start: 2, end: 4, total: 3, relativeIndex: 1 });
        assert.deepStrictEqual(getFolderBounds(4, urls), { start: 2, end: 4, total: 3, relativeIndex: 2 });
    });

    await t.test('cache hit: consecutive calls within same folder range', () => {
        // First call to populate cache
        const result1 = getFolderBounds(2, urls);

        // Second call with different index in same folder
        const result2 = getFolderBounds(3, urls);

        assert.deepStrictEqual(result2, { start: 2, end: 4, total: 3, relativeIndex: 1 });
        // Although we can't easily see if it used the cache, we verify the output is correct.
        // The implementation uses: cachedFolderBoundsUrls === urls && globalIndex >= start && globalIndex <= end
    });

    await t.test('cache miss: folder change', () => {
        getFolderBounds(0, urls); // Cache folder1
        const result = getFolderBounds(2, urls); // Should miss and calculate folder2
        assert.deepStrictEqual(result, { start: 2, end: 4, total: 3, relativeIndex: 0 });
    });

    await t.test('cache miss: different array reference', () => {
        getFolderBounds(0, urls);
        const urlsCopy = [...urls];
        const result = getFolderBounds(0, urlsCopy);
        assert.deepStrictEqual(result, { start: 0, end: 1, total: 2, relativeIndex: 0 });
    });
});

test('isVideoUrl utility', async (t) => {
    await t.test('identifies mp4 video URL correctly', () => {
        const url = `${BASE_URL}/image?path=C:\\Videos\\clip.mp4`;
        assert.strictEqual(isVideoUrl(url), true);
    });

    await t.test('identifies uppercase mp4 video URL correctly', () => {
        const url = `${BASE_URL}/image?path=C:\\Videos\\CLIP.MP4`;
        assert.strictEqual(isVideoUrl(url), true);
    });

    await t.test('identifies ZIP entry mp4 video URL correctly', () => {
        const url = `${BASE_URL}/image?path=C:\\Archive.zip|clip.mp4`;
        assert.strictEqual(isVideoUrl(url), true);
    });

    await t.test('returns false for image URL', () => {
        const url = `${BASE_URL}/image?path=C:\\Photos\\img.jpg`;
        assert.strictEqual(isVideoUrl(url), false);
    });

    await t.test('returns false for empty URL', () => {
        assert.strictEqual(isVideoUrl(''), false);
        assert.strictEqual(isVideoUrl(null), false);
    });
});
