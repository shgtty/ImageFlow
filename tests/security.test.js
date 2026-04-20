const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { isPathInside } = require('../server/utils.js');

test('Path Traversal protection logic', async (t) => {
    const publicDir = path.resolve('/app/public');

    await t.test('allows files inside public directory', () => {
        assert.strictEqual(isPathInside(publicDir, '/app/public/index.html'), true);
        assert.strictEqual(isPathInside(publicDir, '/app/public/js/script.js'), true);
    });

    await t.test('allows the public directory itself', () => {
        assert.strictEqual(isPathInside(publicDir, '/app/public'), true);
        assert.strictEqual(isPathInside(publicDir, '/app/public/'), true);
    });

    await t.test('denies files in similarly named directories (path traversal attack vector)', () => {
        assert.strictEqual(isPathInside(publicDir, '/app/publicsecret'), false);
        assert.strictEqual(isPathInside(publicDir, '/app/public-private/file.txt'), false);
    });

    await t.test('denies files outside the public directory', () => {
        assert.strictEqual(isPathInside(publicDir, '/app/etc/passwd'), false);
        assert.strictEqual(isPathInside(publicDir, '/app/home/user/.ssh/id_rsa'), false);
    });

    await t.test('handles root directory correctly', () => {
        const rootDir = path.resolve('/');
        assert.strictEqual(isPathInside(rootDir, '/etc/passwd'), true);
        assert.strictEqual(isPathInside(rootDir, '/'), true);
    });

    await t.test('handles relative baseDir correctly', () => {
        // Mocking a relative base directory scenario
        const relativeBase = './public';
        const absoluteBase = path.resolve(relativeBase);
        assert.strictEqual(isPathInside(relativeBase, path.join(absoluteBase, 'index.html')), true);
    });
});

test('Config File Path Traversal protection', async (t) => {
    const configDir = path.resolve('/app/config');

    await t.test('allows files inside config directory', () => {
        assert.strictEqual(isPathInside(configDir, '/app/config/folders.txt'), true);
        assert.strictEqual(isPathInside(configDir, '/app/config/custom.txt'), true);
    });

    await t.test('denies files outside the config directory', () => {
        assert.strictEqual(isPathInside(configDir, '/app/secret.txt'), false);
        assert.strictEqual(isPathInside(configDir, '/app/config/../secret.txt'), false);
        assert.strictEqual(isPathInside(configDir, '/etc/passwd'), false);
    });
});
