const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadFolders, cachedConfig, setConfigFile } = require('../server/server.js');

test('loadFolders configuration parsing', async (t) => {
    const mockConfigPath = path.resolve(__dirname, 'mock_folders.txt');

    // Set the config file to our mock path
    setConfigFile(mockConfigPath);

    t.afterEach(() => {
        // Clean up
        if (fs.existsSync(mockConfigPath)) {
            try { fs.unlinkSync(mockConfigPath); } catch (e) {}
        }
        cachedConfig.folders = [];
        // Restore mocks
        t.mock.restoreAll();
    });

    await t.test('creates default config file if it does not exist', (t) => {
        // Mock fs.existsSync to return false for the config file but true for others
        const existsMock = t.mock.method(fs, 'existsSync', (p) => {
            if (p === mockConfigPath) return false;
            return true;
        });

        const writeMock = t.mock.method(fs, 'writeFileSync', () => {});
        const readMock = t.mock.method(fs, 'readFileSync', () => '# default\n/some/path\n');

        loadFolders();

        assert.strictEqual(writeMock.mock.callCount(), 1, 'writeFileSync should be called once');
        assert.strictEqual(writeMock.mock.calls[0].arguments[0], mockConfigPath);
        assert.ok(writeMock.mock.calls[0].arguments[1].includes('#'), 'Default content should be written');
    });

    await t.test('parses folders correctly: trims, ignores comments and empty lines', (t) => {
        const content = `
# This is a comment
  /path/one
/path/two

# Another comment

/path/three
`;
        t.mock.method(fs, 'existsSync', (p) => {
            if (p === mockConfigPath) return true;
            // Pretend all these paths exist
            return true;
        });
        t.mock.method(fs, 'readFileSync', () => content);

        loadFolders();

        const expected = [
            path.resolve('/path/one'),
            path.resolve('/path/two'),
            path.resolve('/path/three')
        ];
        assert.deepStrictEqual(cachedConfig.folders, expected);
    });

    await t.test('filters out folders that do not exist on filesystem', (t) => {
        const content = `/existing/path\n/nonexistent/path`;

        t.mock.method(fs, 'existsSync', (p) => {
            if (p === mockConfigPath) return true;
            if (p.includes('existing')) return true;
            if (p.includes('nonexistent')) return false;
            return false;
        });
        t.mock.method(fs, 'readFileSync', () => content);

        loadFolders();

        assert.strictEqual(cachedConfig.folders.length, 1);
        assert.strictEqual(cachedConfig.folders[0], path.resolve('/existing/path'));
    });

    await t.test('handles filesystem errors gracefully', (t) => {
        t.mock.method(fs, 'existsSync', () => true);
        t.mock.method(fs, 'readFileSync', () => {
            throw new Error('Disk failure');
        });

        // Mock console.error to prevent polluting test output
        const errorMock = t.mock.method(console, 'error', () => {});

        loadFolders();

        assert.strictEqual(errorMock.mock.callCount(), 1);
        assert.ok(errorMock.mock.calls[0].arguments[0].includes('Error handling folders.txt'));
    });
});
