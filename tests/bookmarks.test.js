const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { server, setBookmarksFile, setConfigFile } = require('../server/server.js');

function makeRequest(port, method, pathname, body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: port,
            path: pathname,
            method: method,
            headers: {}
        };
        if (body) {
            options.headers['Content-Type'] = 'application/json';
            options.headers['Content-Length'] = Buffer.byteLength(body);
        }
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: data
                });
            });
        });
        req.on('error', reject);
        if (body) {
            req.write(body);
        }
        req.end();
    });
}

test('Bookmarks API CSV functionality', async (t) => {
    const tempBookmarksPath = path.resolve(__dirname, 'temp_bookmarks.csv');
    const tempConfigPath = path.resolve(__dirname, 'temp_folders.txt');
    let port;

    // Start server on dynamic port
    await new Promise((resolve) => {
        server.listen(0, () => {
            port = server.address().port;
            resolve();
        });
    });

    // Configure test files
    setBookmarksFile(tempBookmarksPath);
    setConfigFile(tempConfigPath);

    // Create a mock folders.txt
    fs.writeFileSync(tempConfigPath, 'C:\\TestFolder1\nC:\\TestFolder2\n', 'utf-8');

    t.after(() => {
        // Stop server
        server.close();
        // Clean up files
        if (fs.existsSync(tempBookmarksPath)) {
            try { fs.unlinkSync(tempBookmarksPath); } catch (e) {}
        }
        if (fs.existsSync(tempConfigPath)) {
            try { fs.unlinkSync(tempConfigPath); } catch (e) {}
        }
    });

    t.afterEach(() => {
        // Clean up bookmarks files between tests
        if (fs.existsSync(tempBookmarksPath)) {
            try { fs.unlinkSync(tempBookmarksPath); } catch (e) {}
        }
    });

    await t.test('GET /api/bookmarks returns empty array when file does not exist', async () => {
        const res = await makeRequest(port, 'GET', '/api/bookmarks');
        assert.strictEqual(res.statusCode, 200);
        const data = JSON.parse(res.body);
        assert.deepStrictEqual(data, { bookmarks: [] });
    });

    await t.test('POST /api/bookmarks (add) saves bookmark in CSV format', async () => {
        const payload = JSON.stringify({ action: 'add', path: 'C:\\TestFolder1\\image.png' });
        const res = await makeRequest(port, 'POST', '/api/bookmarks', payload);
        assert.strictEqual(res.statusCode, 200);
        
        const data = JSON.parse(res.body);
        assert.strictEqual(data.success, true);
        assert.deepStrictEqual(data.bookmarks, ['C:\\TestFolder1\\image.png']);

        // Verify CSV file content
        assert.ok(fs.existsSync(tempBookmarksPath));
        const fileContent = fs.readFileSync(tempBookmarksPath, 'utf-8');
        // Rows should be: dirPath, fileName, configFile
        const expectedCSV = 'C:\\TestFolder1,image.png,temp_folders.txt\n';
        assert.strictEqual(fileContent.replace(/\r\n/g, '\n'), expectedCSV);
    });

    await t.test('GET /api/bookmarks reads CSV format correctly', async () => {
        // Setup CSV file manually
        const csvContent = 'C:\\TestFolder2,pic.jpg,temp_folders.txt\n';
        fs.writeFileSync(tempBookmarksPath, csvContent, 'utf-8');

        const res = await makeRequest(port, 'GET', '/api/bookmarks');
        assert.strictEqual(res.statusCode, 200);
        const data = JSON.parse(res.body);
        assert.deepStrictEqual(data, { bookmarks: ['C:\\TestFolder2\\pic.jpg'] });
    });



    await t.test('POST /api/bookmarks (remove) updates CSV content', async () => {
        // Setup initial CSV
        const initialCSV = 'C:\\TestFolder1,image.png,temp_folders.txt\nC:\\TestFolder2,pic.jpg,temp_folders.txt\n';
        fs.writeFileSync(tempBookmarksPath, initialCSV, 'utf-8');

        const payload = JSON.stringify({ action: 'remove', path: 'C:\\TestFolder1\\image.png' });
        const res = await makeRequest(port, 'POST', '/api/bookmarks', payload);
        assert.strictEqual(res.statusCode, 200);

        const data = JSON.parse(res.body);
        assert.strictEqual(data.success, true);
        assert.deepStrictEqual(data.bookmarks, ['C:\\TestFolder2\\pic.jpg']);

        // Verify CSV file is updated
        const fileContent = fs.readFileSync(tempBookmarksPath, 'utf-8').replace(/\r\n/g, '\n');
        assert.strictEqual(fileContent, 'C:\\TestFolder2,pic.jpg,temp_folders.txt\n');
    });

    await t.test('GET /api/bookmark-config returns the config file name for a bookmark', async () => {
        // Setup initial CSV
        const csvContent = 'C:\\TestFolder1,image.png,temp_folders.txt\nC:\\TestFolder2,pic.jpg,another_config.txt\n';
        fs.writeFileSync(tempBookmarksPath, csvContent, 'utf-8');

        // Check first bookmark
        let res = await makeRequest(port, 'GET', `/api/bookmark-config?path=${encodeURIComponent('C:\\TestFolder1\\image.png')}`);
        assert.strictEqual(res.statusCode, 200);
        let data = JSON.parse(res.body);
        assert.deepStrictEqual(data, { configFile: 'temp_folders.txt' });

        // Check second bookmark
        res = await makeRequest(port, 'GET', `/api/bookmark-config?path=${encodeURIComponent('C:\\TestFolder2\\pic.jpg')}`);
        assert.strictEqual(res.statusCode, 200);
        data = JSON.parse(res.body);
        assert.deepStrictEqual(data, { configFile: 'another_config.txt' });

        // Check non-existent bookmark
        res = await makeRequest(port, 'GET', `/api/bookmark-config?path=${encodeURIComponent('C:\\TestFolder3\\no.jpg')}`);
        assert.strictEqual(res.statusCode, 200);
        data = JSON.parse(res.body);
        assert.deepStrictEqual(data, { configFile: null });
    });
});
