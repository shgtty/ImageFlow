const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8000;
// コマンドライン引数から設定ファイル名を取得。指定がない場合は 'folders.txt' にフォールバック
const CONFIG_FILE = process.argv[2] || 'folders.txt';
const VALID_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

// 指定されたディレクトリを再帰的に検索して画像ファイルのリストを取得する
function getImagesFromDirectory(dirPath) {
    let results = [];
    try {
        const list = fs.readdirSync(dirPath);
        for (const file of list) {
            const filePath = path.join(dirPath, file);
            try {
                const stat = fs.statSync(filePath);
                if (stat && stat.isDirectory()) {
                    results = results.concat(getImagesFromDirectory(filePath));
                } else {
                    const ext = path.extname(filePath).toLowerCase();
                    if (VALID_EXTS.has(ext)) {
                        results.push(filePath);
                    }
                }
            } catch(e) { /* アクセス権限等で読めないファイルはスキップ */ }
        }
    } catch (err) {
        console.error(`Error reading ${dirPath}: ${err.message}`);
    }
    return results;
}

const server = http.createServer((req, res) => {
    // CORS headers just in case
    res.setHeader('Access-Control-Allow-Origin', '*');

    const reqUrl = new URL(req.url, `http://${req.headers.host}`);

    if (reqUrl.pathname === '/api/images') {
        let folders = [];
        try {
            if (fs.existsSync(CONFIG_FILE)) {
                const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
                folders = content.split('\n')
                                 .map(line => line.trim())
                                 .filter(line => line && fs.existsSync(line) && fs.statSync(line).isDirectory());
            } else {
                // folders.txt がない場合は空のファイルを作成
                fs.writeFileSync(CONFIG_FILE, 'C:\\\n', 'utf-8');
            }
        } catch (err) {
            console.error('Error handling folders.txt:', err);
        }

        let allImages = [];
        for (const folder of folders) {
            allImages = allImages.concat(getImagesFromDirectory(folder));
        }

        // Shuffle (Fisher-Yates)
        for (let i = allImages.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allImages[i], allImages[j]] = [allImages[j], allImages[i]];
        }

        const limitImages = allImages.slice(0, 1000);
        const imageUrls = limitImages.map(img => `/image?path=${encodeURIComponent(img)}`);

        res.writeHead(200, { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
        res.end(JSON.stringify({
            totalFound: allImages.length,
            count: limitImages.length,
            images: imageUrls,
            foldersUsed: folders
        }));
        return;
    }

    if (reqUrl.pathname === '/image') {
        const imgPath = reqUrl.searchParams.get('path');
        if (imgPath && fs.existsSync(imgPath)) {
            const ext = path.extname(imgPath).toLowerCase();
            let mimeType = 'image/jpeg';
            if (ext === '.png') mimeType = 'image/png';
            if (ext === '.gif') mimeType = 'image/gif';
            if (ext === '.webp') mimeType = 'image/webp';

            res.writeHead(200, { 
                'Content-Type': mimeType,
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            });
            const stream = fs.createReadStream(imgPath);
            stream.pipe(res);
            return;
        } else {
            res.writeHead(404);
            res.end('Image not found');
            return;
        }
    }

    // Serve static files (index.html, script.js)
    let filePath = path.join(__dirname, reqUrl.pathname === '/' ? 'index.html' : reqUrl.pathname);
    const ext = path.extname(filePath);
    let contentType = 'text/html';
    if (ext === '.js') contentType = 'text/javascript';
    if (ext === '.css') contentType = 'text/css';

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(filePath).pipe(res);
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

server.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`Image Server is running at http://localhost:${PORT}/`);
    console.log(`Please edit the 'folders.txt' file in this directory`);
    console.log(`to add or change the target image folders.`);
    console.log(`=========================================`);
});
