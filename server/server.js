const http = require('http');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { isPathInside } = require('./utils');

const zipCache = new Map();
const MAX_CACHE_SIZE = 100;

const PORT = 8000;
let initialArg = process.argv[2] || path.join(__dirname, '..', 'config', 'folders.txt');
let CONFIG_FILE = initialArg;
let configDir = null;

if (fs.existsSync(initialArg) && fs.statSync(initialArg).isDirectory()) {
    configDir = initialArg;
    // 設定フォルダ内に前回の設定ファイル名を保存する
    const lastConfStatePath = path.join(configDir, '.last_config.state');
    let activeConf = null;
    if (fs.existsSync(lastConfStatePath)) {
        const saved = fs.readFileSync(lastConfStatePath, 'utf8').trim();
        if (saved && fs.existsSync(path.join(configDir, saved))) {
            activeConf = saved;
        }
    }
    if (!activeConf) {
        let files = [];
        try {
            files = fs.readdirSync(configDir).filter(f => f.endsWith('.txt'));
        } catch(e) {}
        if (files.length > 0) {
            activeConf = files[0];
        } else {
            activeConf = 'folders.txt';
        }
    }
    CONFIG_FILE = path.join(configDir, activeConf);
}
const INCLUDE_FILE = process.argv[3] || path.join(__dirname, '..', 'config', 'include.txt');
const EXCLUDE_FILE = process.argv[4] || path.join(__dirname, '..', 'config', 'exclude.txt');
const VALID_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
const MAX_BODY_SIZE = 1 * 1024 * 1024; // 1MB

/**
 * Safely collects the request body, enforcing a maximum size limit.
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {function(string): void} callback
 */
function collectRequestBody(req, res, callback) {
    let body = '';
    let size = 0;
    let limitExceeded = false;

    req.on('data', chunk => {
        if (limitExceeded) return;
        size += chunk.length;
        if (size > MAX_BODY_SIZE) {
            limitExceeded = true;
            res.writeHead(413, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Payload Too Large' }));
            req.destroy();
            return;
        }
        body += chunk.toString();
    });

    req.on('end', () => {
        if (!limitExceeded) {
            callback(body);
        }
    });
}

// ⚡ Bolt Optimization: Memory cache for configuration to avoid synchronous file reads blocking event loop
const cachedConfig = {
    folders: [],
    includes: [],
    excludes: [],
    includeMode: 'AND',
    includesLower: [],
    excludesLower: []
};

function loadFolders() {
    try {
        if (!fs.existsSync(CONFIG_FILE)) {
            const defaultFoldersText = `# 画像を読み込みたいフォルダのフルパスを1行ずつ記述してください。サブフォルダも自動的に検索されます。\n# 先頭が「#」で始まる行はコメントとして無視されます。\n\n# 例:\n# C:\\Users\\Public\\Pictures\n# D:\\Photos\\Vacation\nC:\\\n`;
            fs.writeFileSync(CONFIG_FILE, defaultFoldersText, 'utf-8');
        }
        const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
        cachedConfig.folders = content.split('\n')
                         .map(line => line.trim())
                         .filter(line => line && !line.startsWith('#'))
                         .map(line => path.resolve(line))
                         .filter(line => fs.existsSync(line));
    } catch (err) {
        console.error('Error handling folders.txt:', err);
    }
}

function loadIncludes() {
    try {
        if (!fs.existsSync(INCLUDE_FILE)) {
            const defaultIncludeText = `# ここに記述された文字列がファイルパスに含まれる画像のみを表示します（1行に1つ）\n# デフォルトはすべての単語を含む画像を表示する「AND検索」です。\n# どれか一つでも含むものを表示する「OR検索」に切り替えたい場合は、ファイル内に MODE:OR と記述してください。\n\n# 例:\nanime\nsummer\n`;
            fs.writeFileSync(INCLUDE_FILE, defaultIncludeText, 'utf-8');
        }
        let lines = fs.readFileSync(INCLUDE_FILE, 'utf-8')
                     .split('\n')
                     .map(l => l.trim())
                     .filter(l => l && !l.startsWith('#'));

        if (lines.includes('MODE:OR')) {
            cachedConfig.includeMode = 'OR';
            lines = lines.filter(l => l !== 'MODE:OR');
        } else if (lines.includes('MODE:AND')) {
            cachedConfig.includeMode = 'AND';
            lines = lines.filter(l => l !== 'MODE:AND');
        } else {
            cachedConfig.includeMode = 'AND';
        }

        cachedConfig.includes = lines;
        cachedConfig.includesLower = cachedConfig.includes.map(inc => inc.toLowerCase());
    } catch (err) {
        console.error('Error handling include.txt:', err);
    }
}

function loadExcludes() {
    try {
        if (!fs.existsSync(EXCLUDE_FILE)) {
            fs.writeFileSync(EXCLUDE_FILE, '# ここに記述された文字列がファイルパスに含まれる画像を除外します（1行に1つ）\n# 例: thumbnail\n', 'utf-8');
        }
        cachedConfig.excludes = fs.readFileSync(EXCLUDE_FILE, 'utf-8')
                     .split('\n')
                     .map(l => l.trim())
                     .filter(l => l && !l.startsWith('#'));
        cachedConfig.excludesLower = cachedConfig.excludes.map(exc => exc.toLowerCase());
    } catch (err) {
        console.error('Error handling exclude.txt:', err);
    }
}

// Initial load
loadFolders();
loadIncludes();
loadExcludes();

let configWatcher = null;
function watchFile(filePath, reloadFunc, label) {
    if (!fs.existsSync(path.dirname(filePath))) {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
    }
    let watchDebounceTimeout = null;
    const watcher = fs.watch(filePath, (eventType) => {
        if (eventType === 'change' || eventType === 'rename') {
            if (watchDebounceTimeout) clearTimeout(watchDebounceTimeout);
            watchDebounceTimeout = setTimeout(() => {
                try {
                    reloadFunc();
                    console.log(`[Config Watcher] Reloaded ${label} (${eventType})`);
                } catch(e) {
                    // Ignore transient read errors during save
                }
            }, 100);
        }
    });
    if (watcher.unref) watcher.unref();
    return watcher;
}

// Watch for changes
configWatcher = watchFile(CONFIG_FILE, loadFolders, 'folders.txt');
watchFile(INCLUDE_FILE, loadIncludes, 'include.txt');
watchFile(EXCLUDE_FILE, loadExcludes, 'exclude.txt');

function getZipInstance(zipPath) {
    const stats = fs.statSync(zipPath);
    const mtime = stats.mtimeMs;

    if (zipCache.has(zipPath)) {
        const cached = zipCache.get(zipPath);
        if (cached.mtime === mtime) {
            return cached.zip;
        }
    }

    const zip = new AdmZip(zipPath);

    // Simple LRU-like eviction: clear cache if it grows too large
    if (zipCache.size >= MAX_CACHE_SIZE) {
        zipCache.clear();
    }

    zipCache.set(zipPath, { zip, mtime });
    return zip;
}

function getAllowedPaths() {
    return cachedConfig.folders;
}

/**
 * Parses ZIP contents and adds valid image entries to the results array.
 * @param {string} zipPath - The path to the ZIP file.
 * @param {string[]} results - The array to collect image paths.
 */
function getImagesFromZip(zipPath, results) {
    try {
        const zip = getZipInstance(zipPath);
        const zipEntries = zip.getEntries();
        for (const entry of zipEntries) {
            if (!entry.isDirectory) {
                const entryExt = path.extname(entry.entryName).toLowerCase();
                if (VALID_EXTS.has(entryExt)) {
                    results.push(`${zipPath}|${entry.entryName}`);
                }
            }
        }
    } catch (zipErr) {
        console.error(`Error reading ZIP file ${zipPath}:`, zipErr.message);
    }
}

// ⚡ Bolt Optimization: Recursive helper that takes Dirent array from withFileTypes to prevent redundant fs.statSync calls
function processDirents(basePath, dirents, results) {
    for (const dirent of dirents) {
        const fullPath = path.join(basePath, dirent.name);

        let isDir = dirent.isDirectory();
        let isFil = dirent.isFile();

        // ⚡ Bolt: Handle symlinks by falling back to statSync, preserving original behavior
        if (dirent.isSymbolicLink()) {
            try {
                const stat = fs.statSync(fullPath);
                isDir = stat.isDirectory();
                isFil = stat.isFile();
            } catch (err) {
                continue; // Skip broken symlinks
            }
        }

        if (isDir) {
            try {
                // ⚡ Bolt: Read subdirectories directly using withFileTypes
                const subDirents = fs.readdirSync(fullPath, { withFileTypes: true });
                processDirents(fullPath, subDirents, results);
            } catch (err) {
                // Ignore inaccessible directories
            }
        } else if (isFil) {
            const ext = path.extname(dirent.name).toLowerCase();
            if (VALID_EXTS.has(ext)) {
                results.push(fullPath);
            } else if (ext === '.zip') {
                getImagesFromZip(fullPath, results);
            }
        }
    }
}

// 指定されたパス（ディレクトリまたは単一ファイル）を処理し、画像ファイルのリストを取得する
function getImagesFromPath(targetPath, results = []) {
    try {
        const stat = fs.statSync(targetPath);
        
        if (stat.isFile()) {
            const ext = path.extname(targetPath).toLowerCase();
            if (VALID_EXTS.has(ext)) {
                results.push(targetPath);
            } else if (ext === '.zip') {
                getImagesFromZip(targetPath, results);
            }
            return results;
        }

        if (stat.isDirectory()) {
            // ⚡ Bolt Optimization: Use withFileTypes: true to avoid calling statSync on every file
            const dirents = fs.readdirSync(targetPath, { withFileTypes: true });
            processDirents(targetPath, dirents, results);
            return results;
        }
    } catch (err) {
        // アクセス権限等で読めないパスは静かにスキップする
    }
    return results;
}

const server = http.createServer((req, res) => {
    // Security headers
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none';");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // CORS headers just in case
    res.setHeader('Access-Control-Allow-Origin', '*');

    const reqUrl = new URL(req.url, `http://${req.headers.host}`);
    const rawPathname = req.url.split('?')[0];

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (reqUrl.pathname === '/api/config-files') {
        if (!configDir) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Config directory is not set' }));
            return;
        }
        fs.promises.readdir(configDir)
            .then(files => {
                const txtFiles = files.filter(f => f.toLowerCase().endsWith('.txt'));
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    files: txtFiles,
                    current: path.basename(CONFIG_FILE)
                }));
            })
            .catch(e => {
                res.writeHead(500);
                res.end(JSON.stringify({ error: 'Failed to read config directory' }));
            });
        return;
    }

    if (reqUrl.pathname === '/api/set-config-file') {
        if (req.method === 'POST') {
            collectRequestBody(req, res, (body) => {
                try {
                    const data = JSON.parse(body);
                    if (data.file && configDir) {
                        const newConfigPath = path.join(configDir, data.file);

                        if (isPathInside(configDir, newConfigPath) && fs.existsSync(newConfigPath) && fs.statSync(newConfigPath).isFile()) {
                            // Update CONFIG_FILE and save to state
                            CONFIG_FILE = newConfigPath;
                            const lastConfStatePath = path.join(configDir, '.last_config.state');
                            fs.writeFileSync(lastConfStatePath, data.file, 'utf8');

                            // Re-watch the new file
                            if (configWatcher) {
                                configWatcher.close();
                            }
                            configWatcher = watchFile(CONFIG_FILE, loadFolders, 'folders.txt');

                            // Reload settings
                            loadFolders();

                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: true, file: data.file }));
                            return;
                        }
                    }
                } catch(e) {
                    console.error('Error changing config file:', e);
                }
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Bad Request' }));
            });
            return;
        }
    }

    if (reqUrl.pathname === '/api/config-file-content') {
        if (req.method === 'GET') {
            const file = reqUrl.searchParams.get('file');
            if (file && configDir) {
                const targetPath = path.join(configDir, file);
                if (isPathInside(configDir, targetPath) && fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
                    try {
                        const content = fs.readFileSync(targetPath, 'utf8');
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ content }));
                        return;
                    } catch (e) {
                        console.error('Error reading config file content:', e);
                        res.writeHead(500);
                        res.end(JSON.stringify({ error: 'Failed to read file' }));
                        return;
                    }
                }
            }
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Bad Request' }));
            return;
        } else if (req.method === 'POST') {
            collectRequestBody(req, res, (body) => {
                try {
                    const data = JSON.parse(body);
                    if (data.file && data.content !== undefined && configDir) {
                        const targetPath = path.join(configDir, data.file);
                        if (isPathInside(configDir, targetPath) && fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
                            fs.writeFileSync(targetPath, data.content, 'utf8');
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: true }));
                            return;
                        }
                    }
                } catch(e) {
                    console.error('Error saving config file content:', e);
                }
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Bad Request' }));
            });
            return;
        }
    }

    if (reqUrl.pathname === '/api/include-file') {
        if (req.method === 'GET') {
            try {
                let text = '';
                if (fs.existsSync(INCLUDE_FILE)) {
                    text = fs.readFileSync(INCLUDE_FILE, 'utf-8');
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ text }));
            } catch (e) {
                res.writeHead(500);
                res.end(JSON.stringify({ error: 'Failed to read include.txt' }));
            }
            return;
        } else if (req.method === 'POST') {
            collectRequestBody(req, res, (body) => {
                try {
                    const data = JSON.parse(body);
                    if (data.text !== undefined) {
                        fs.writeFileSync(INCLUDE_FILE, data.text, 'utf-8');
                        // loadIncludes will be triggered by file watcher
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true }));
                        return;
                    }
                } catch(e) {
                    console.error('Error writing include file:', e);
                }
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Bad Request' }));
            });
            return;
        }
    }

    if (reqUrl.pathname === '/api/images') {
        const sortMode = reqUrl.searchParams.get('sort') || 'random';
        const enableInclude = reqUrl.searchParams.get('enableInclude') !== 'false';
        let folders = getAllowedPaths();
        
        // ⚡ Bolt Optimization: Use cached configuration arrays instead of synchronous file reads
        let includes = [];
        let includesLower = [];
        let includeMode = cachedConfig.includeMode;
        
        if (enableInclude) {
            includes = cachedConfig.includes;
            includesLower = cachedConfig.includesLower;
        }

        const excludes = cachedConfig.excludes;
        const excludesLower = cachedConfig.excludesLower;

        let allImages = [];

        // ⚡ Bolt Optimization: Avoid memory overhead of Array.prototype.concat in loops by passing accumulator to getImagesFromPath
        const allImagesRaw = [];
        for (const target of folders) {
            getImagesFromPath(target, allImagesRaw);
        }

        // Apply filters directly to allImagesRaw in-place or pushing to allImages to avoid mapping
        // ⚡ Bolt Optimization: Skip O(N) string processing when no filters are set
        if (includesLower.length === 0 && excludesLower.length === 0) {
            allImages = allImagesRaw;
        } else {
            for (let i = 0; i < allImagesRaw.length; i++) {
                const imgPath = allImagesRaw[i];
                const pathLower = imgPath.toLowerCase();

                let includeMatch = true;
                if (includesLower.length > 0) {
                    if (includeMode === 'AND') {
                        includeMatch = includesLower.every(inc => pathLower.includes(inc));
                    } else {
                        includeMatch = includesLower.some(inc => pathLower.includes(inc));
                    }
                }

                let excludeMatch = false;
                if (excludesLower.length > 0) {
                    excludeMatch = excludesLower.some(exc => pathLower.includes(exc));
                }

                if (includeMatch && !excludeMatch) {
                    allImages.push(imgPath);
                }
            }
        }

        // ⚡ Bolt Optimization: Pre-instantiate Intl.Collator for massive sorting performance gains over String.prototype.localeCompare
        const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

        if (sortMode === 'asc') {
            allImages.sort(collator.compare);
        } else if (sortMode === 'folder-random') {
            const groups = new Map();
            for (let i = 0; i < allImages.length; i++) {
                const img = allImages[i];
                const folderKey = img.includes('|') ? img.split('|')[0] : path.dirname(img);
                if (!groups.has(folderKey)) {
                    groups.set(folderKey, []);
                }
                groups.get(folderKey).push(img);
            }
            const sortedKeys = Array.from(groups.keys()).sort(collator.compare);
            
            allImages = [];
            for (const key of sortedKeys) {
                const groupImgs = groups.get(key);
                for (let i = groupImgs.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [groupImgs[i], groupImgs[j]] = [groupImgs[j], groupImgs[i]];
                }
                for (let i = 0; i < groupImgs.length; i++) {
                    allImages.push(groupImgs[i]);
                }
            }
        } else {
            // Shuffle (Fisher-Yates)
            for (let i = allImages.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [allImages[i], allImages[j]] = [allImages[j], allImages[i]];
            }
        }

        const limitImages = allImages; // 制限を解除 (Remove the 1000 image limit)
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
            foldersUsed: folders,
            filterMode: includeMode,
            filterInclude: includes,
            isConfigDir: !!configDir
        }));
        return;
    }

    if (reqUrl.pathname === '/image') {
        const imgPath = reqUrl.searchParams.get('path');
        
        if (imgPath) {
            // ZIP内の仮想パスかどうかを判定
            const isZipEntry = imgPath.includes('|');
            const [basePath, entryName] = isZipEntry ? imgPath.split('|') : [imgPath, null];

            // Path Traversal check
            const resolvedPath = path.resolve(basePath);
            const allowedPaths = getAllowedPaths();
            const isAllowed = allowedPaths.some(allowed => isPathInside(allowed, resolvedPath));

            if (!isAllowed) {
                res.writeHead(403);
                res.end('Access denied');
                return;
            }

            const actualExt = isZipEntry ? path.extname(entryName).toLowerCase() : path.extname(resolvedPath).toLowerCase();
            
            if (!VALID_EXTS.has(actualExt)) {
                res.writeHead(403);
                res.end('Access denied');
                return;
            }

            let mimeType = 'image/jpeg';
            if (actualExt === '.png') mimeType = 'image/png';
            if (actualExt === '.gif') mimeType = 'image/gif';
            if (actualExt === '.webp') mimeType = 'image/webp';

            const headers = {
                'Content-Type': mimeType,
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            };

            if (isZipEntry) {
                // ZIPファイルの特定データをメモリに展開・バッファ提供フロー
                // ⚡ Bolt Optimization: Use async readFileAsync to avoid blocking the event loop while extracting large ZIP entries
                try {
                    const zip = getZipInstance(resolvedPath);
                    zip.readFileAsync(entryName, (data, err) => {
                        if (err || !data) {
                            if (err) console.error('Error extracting from zip:', err);
                            res.writeHead(404);
                            res.end('Image not found');
                            return;
                        }
                        res.writeHead(200, headers);
                        res.end(data); // メモリ上のバッファを直接レスポンスするためHDD消費なし
                    });
                    return; // Prevent fallthrough to 404 below while async operation runs
                } catch (e) {
                    console.error('Error initializing zip extraction:', e.message);
                    // fallthrough to 404
                }
            } else {
                // 通常のファイル提供ストリーミングフロー
                // ⚡ Bolt Optimization: Use async fs.promises.stat to preserve isFile check without blocking event loop
                fs.promises.stat(resolvedPath)
                    .then(stats => {
                        if (stats.isFile()) {
                            const stream = fs.createReadStream(resolvedPath);
                            stream.on('open', () => {
                                res.writeHead(200, headers);
                                stream.pipe(res);
                            });
                            stream.on('error', () => {
                                if (!res.headersSent) {
                                    res.writeHead(404);
                                    res.end('Image not found');
                                } else {
                                    res.end();
                                }
                            });
                        } else {
                            res.writeHead(404);
                            res.end('Image not found');
                        }
                    })
                    .catch(() => {
                        res.writeHead(404);
                        res.end('Image not found');
                    });
                return;
            }
        }
        
        res.writeHead(404);
        res.end('Image not found');
        return;
    }

    // Serve static files from 'public' directory
    const publicDir = path.resolve(__dirname, '..', 'public');
    let requestedPath = (rawPathname === '/' || rawPathname === '') ? '/index.html' : rawPathname;

    // Decode URI component to handle %2e etc.
    try {
        requestedPath = decodeURIComponent(requestedPath);
    } catch (e) {
        res.writeHead(400);
        res.end('Bad Request');
        return;
    }

    const filePath = path.join(publicDir, requestedPath);
    const resolvedPath = path.resolve(filePath);

    // Security check: ensure the resolved path is within the public directory
    if (!isPathInside(publicDir, resolvedPath)) {
        res.writeHead(403);
        res.end('Access denied');
        return;
    }

    const ext = path.extname(resolvedPath);
    let contentType = 'text/html';
    if (ext === '.js') contentType = 'text/javascript';
    if (ext === '.css') contentType = 'text/css';

    // ⚡ Bolt Optimization: Use async fs.promises.stat to preserve isFile check without blocking event loop
    fs.promises.stat(resolvedPath)
        .then(stats => {
            if (stats.isFile()) {
                res.writeHead(200, { 'Content-Type': contentType });
                fs.createReadStream(resolvedPath).pipe(res);
            } else {
                res.writeHead(404);
                res.end('Not found');
            }
        })
        .catch(() => {
            res.writeHead(404);
            res.end('Not found');
        });
});

if (require.main === module) {
    server.listen(PORT, () => {
        console.log(`=========================================`);
        console.log(`Image Server is running at http://localhost:${PORT}/`);
        console.log(`Please edit the 'folders.txt' file in the 'config' directory`);
        console.log(`to add or change the target image folders.`);
        console.log(`=========================================`);
    });
}

module.exports = {
    getImagesFromPath,
    VALID_EXTS
};
