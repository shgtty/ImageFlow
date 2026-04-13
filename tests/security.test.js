const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

// Logic from server/server.js
function isSafeNew(baseDir, resolvedPath) {
    const base = baseDir.endsWith(path.sep) ? baseDir : baseDir + path.sep;
    return resolvedPath === baseDir || resolvedPath.startsWith(base);
}

test('Path Traversal protection logic', async (t) => {
    const publicDir = path.resolve('/app/public');

    await t.test('allows files inside public directory', () => {
        assert.strictEqual(isSafeNew(publicDir, path.resolve('/app/public/index.html')), true);
        assert.strictEqual(isSafeNew(publicDir, path.resolve('/app/public/js/script.js')), true);
    });

    await t.test('allows the public directory itself', () => {
        assert.strictEqual(isSafeNew(publicDir, path.resolve('/app/public')), true);
        assert.strictEqual(isSafeNew(publicDir, path.resolve('/app/public/')), true);
    });

    await t.test('denies files in similarly named directories (path traversal attack vector)', () => {
        assert.strictEqual(isSafeNew(publicDir, path.resolve('/app/publicsecret')), false);
        assert.strictEqual(isSafeNew(publicDir, path.resolve('/app/public-private/file.txt')), false);
    });

    await t.test('denies files outside the public directory', () => {
        assert.strictEqual(isSafeNew(publicDir, path.resolve('/app/etc/passwd')), false);
        assert.strictEqual(isSafeNew(publicDir, path.resolve('/app/home/user/.ssh/id_rsa')), false);
    });

    await t.test('handles root directory correctly', () => {
        const rootDir = path.resolve('/');
        assert.strictEqual(isSafeNew(rootDir, path.resolve('/etc/passwd')), true);
        assert.strictEqual(isSafeNew(rootDir, path.resolve('/')), true);
    });
});
