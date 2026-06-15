const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const AdmZip = require('adm-zip');
const { server, setConfigFile, loadFolders } = require('../server/server.js');

function makeRequest(port, method, pathname) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: port,
            path: pathname,
            method: method,
        };
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
        req.end();
    });
}

test('Folder random sorting for ZIP subfolders', async (t) => {
    const tempConfigPath = path.resolve(__dirname, 'temp_folders_zip.txt');
    const tempZipPath = path.resolve(__dirname, 'temp_archive.zip');
    let port;

    // Start server on dynamic port
    await new Promise((resolve) => {
        server.listen(0, () => {
            port = server.address().port;
            resolve();
        });
    });

    // Create a mock ZIP file
    const zip = new AdmZip();
    zip.addFile("subfolder1/img1.jpg", Buffer.alloc(0));
    zip.addFile("subfolder1/img2.jpg", Buffer.alloc(0));
    zip.addFile("subfolder2/img3.jpg", Buffer.alloc(0));
    zip.addFile("subfolder2/img4.jpg", Buffer.alloc(0));
    zip.writeZip(tempZipPath);

    // Point config to ZIP file
    setConfigFile(tempConfigPath);
    fs.writeFileSync(tempConfigPath, tempZipPath + '\n', 'utf-8');
    loadFolders();

    t.after(() => {
        // Stop server
        server.close();
        // Clean up files
        if (fs.existsSync(tempConfigPath)) {
            try { fs.unlinkSync(tempConfigPath); } catch (e) {}
        }
        if (fs.existsSync(tempZipPath)) {
            try { fs.unlinkSync(tempZipPath); } catch (e) {}
        }
    });

    await t.test('GET /api/images?sort=folder-random groups and shuffles at the subfolder level', async () => {
        const res = await makeRequest(port, 'GET', '/api/images?sort=folder-random');
        assert.strictEqual(res.statusCode, 200);
        
        const data = JSON.parse(res.body);
        assert.strictEqual(data.totalFound, 4);
        
        // Verify that images are grouped by subfolders (all images from subfolder1 are contiguous, and all from subfolder2 are contiguous)
        const images = data.images;
        
        // Convert URLs back to paths or just check their subdirectory structure.
        const paths = images.map(imgUrl => {
            const match = /[?&]path=([^&#]*)/.exec(imgUrl);
            return decodeURIComponent(match[1]);
        });

        // The subfolders should be contiguous.
        let groupChanges = 0;
        let lastGroup = null;
        for (const p of paths) {
            const innerPath = p.split('|')[1];
            const group = innerPath.substring(0, innerPath.lastIndexOf('/'));
            if (group !== lastGroup) {
                groupChanges++;
                lastGroup = group;
            }
        }
        
        // If they are contiguous, groupChanges should be exactly 2 (first group, then second group).
        assert.strictEqual(groupChanges, 2, `Expected images from the same subfolder inside ZIP to be contiguous (got sequence: ${paths.map(p => p.split('|')[1]).join(', ')})`);
    });
});
