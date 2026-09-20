const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadFolders, cachedConfig, setConfigFile, setConfigDir, getStateFilePath, readSavedConfigFiles } = require('../server/server.js');

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

test('mode-specific config file state handling', async (t) => {
    const tempConfigDir = path.resolve(__dirname, 'temp_mode_config_dir');
    if (!fs.existsSync(tempConfigDir)) {
        fs.mkdirSync(tempConfigDir, { recursive: true });
    }
    setConfigDir(tempConfigDir);

    const galleryState = path.join(tempConfigDir, '.last_config_gallery.state');
    const dualState = path.join(tempConfigDir, '.last_config_dual.state');
    const galleryTxt = path.join(tempConfigDir, 'gallery.txt');
    const dualTxt = path.join(tempConfigDir, 'dual.txt');
    const defaultTxt = path.join(tempConfigDir, 'folders.txt');

    fs.writeFileSync(galleryTxt, 'C:\\dummy1\n', 'utf8');
    fs.writeFileSync(dualTxt, 'C:\\dummy2\n', 'utf8');
    fs.writeFileSync(defaultTxt, 'C:\\dummy3\n', 'utf8');

    t.after(() => {
        // Cleanup temp dir
        try {
            fs.rmSync(tempConfigDir, { recursive: true, force: true });
        } catch(e) {}
        setConfigDir(null);
    });

    await t.test('getStateFilePath returns correct paths for gallery and dual', () => {
        assert.strictEqual(getStateFilePath('gallery'), galleryState);
        assert.strictEqual(getStateFilePath('dual'), dualState);
        assert.strictEqual(getStateFilePath(''), galleryState);
        assert.strictEqual(getStateFilePath(null), galleryState);
    });

    await t.test('readSavedConfigFiles retrieves mode-specific files independently', () => {
        fs.writeFileSync(galleryState, JSON.stringify(['gallery.txt']), 'utf8');
        fs.writeFileSync(dualState, JSON.stringify(['dual.txt']), 'utf8');

        const galleryConfigs = readSavedConfigFiles('gallery');
        const dualConfigs = readSavedConfigFiles('dual');

        assert.deepStrictEqual(galleryConfigs, ['gallery.txt']);
        assert.deepStrictEqual(dualConfigs, ['dual.txt']);
    });

    await t.test('readSavedConfigFiles falls back to mode default txt files when state does not exist', () => {
        if (fs.existsSync(galleryState)) fs.unlinkSync(galleryState);
        if (fs.existsSync(dualState)) fs.unlinkSync(dualState);

        const dualTxtPath = path.join(tempConfigDir, 'dual_folders.txt');
        fs.writeFileSync(dualTxtPath, 'C:\\dummy_dual\n', 'utf8');

        const galleryConfigs = readSavedConfigFiles('gallery');
        const dualConfigs = readSavedConfigFiles('dual');

        assert.deepStrictEqual(galleryConfigs, ['folders.txt']);
        assert.deepStrictEqual(dualConfigs, ['dual_folders.txt']);
    });
});

