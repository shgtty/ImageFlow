const http = require('http');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const PORT = 8000;
// コマンドライン引数から各設定ファイル名を取得（指定がない場合はデフォルト名にフォールバック）
const CONFIG_FILE = process.argv[2] || path.join(__dirname, '..', 'config', 'folders.txt');
const INCLUDE_FILE = process.argv[3] || path.join(__dirname, '..', 'config', 'include.txt');
const EXCLUDE_FILE = process.argv[4] || path.join(__dirname, '..', 'config', 'exclude.txt');
const VALID_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

// 指定されたパス（ディレクトリまたは単一ファイル）を処理し、画像ファイルのリストを取得する
function getImagesFromPath(targetPath) {
    let results = [];
    try {
        const stat = fs.statSync(targetPath);
        
        if (stat.isFile()) {
            const ext = path.extname(targetPath).toLowerCase();
            if (VALID_EXTS.has(ext)) {
                results.push(targetPath);
            } else if (ext === '.zip') {
                try {
                    const zip = new AdmZip(targetPath);
                    const zipEntries = zip.getEntries();
                    for (const entry of zipEntries) {
                        if (!entry.isDirectory) {
                            const entryExt = path.extname(entry.entryName).toLowerCase();
                            if (VALID_EXTS.has(entryExt)) {
                                results.push(`${targetPath}|${entry.entryName}`);
                            }
                        }
                    }
                } catch (zipErr) {
                    console.error(`Error reading ZIP file ${targetPath}:`, zipErr.message);
                }
            }
            return results;
        }

        if (stat.isDirectory()) {
            const list = fs.readdirSync(targetPath);
            for (const file of list) {
                const filePath = path.join(targetPath, file);
                results = results.concat(getImagesFromPath(filePath)); // 個別のファイルごとに関数を再帰呼び出し
            }
            return results;
        }
    } catch (err) {
        // アクセス権限等で読めないパスは静かにスキップする
    }
    return results;
}

const server = http.createServer((req, res) => {
    // CORS headers just in case
    res.setHeader('Access-Control-Allow-Origin', '*');

    const reqUrl = new URL(req.url, `http://${req.headers.host}`);

    if (reqUrl.pathname === '/api/images') {
        const sortMode = reqUrl.searchParams.get('sort') || 'random';
        let folders = [];
        try {
            if (fs.existsSync(CONFIG_FILE)) {
                const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
                folders = content.split('\n')
                                 .map(line => line.trim())
                                 // 「#」で始まる行はコメントとして除外。またディレクトリだけでなく直接入力されたファイル自体も許容する
                                 .filter(line => line && !line.startsWith('#') && fs.existsSync(line));
            } else {
                // folders.txt がない場合は説明文つきのひな形を作成
                const defaultFoldersText = `# 画像を読み込みたいフォルダのフルパスを1行ずつ記述してください。サブフォルダも自動的に検索されます。\n# 先頭が「#」で始まる行はコメントとして無視されます。\n\n# 例:\n# C:\\Users\\Public\\Pictures\n# D:\\Photos\\Vacation\nC:\\\n`;
                fs.writeFileSync(CONFIG_FILE, defaultFoldersText, 'utf-8');
            }
        } catch (err) {
            console.error('Error handling folders.txt:', err);
        }
        
        // フィルタリング設定ファイル（ホワイトリスト・ブラックリスト）の読み込み
        let includes = [];
        let excludes = [];
        let includeMode = 'AND'; // デフォルトの判定モードをANDに変更
        
        try {
            if (fs.existsSync(INCLUDE_FILE)) {
                let lines = fs.readFileSync(INCLUDE_FILE, 'utf-8')
                             .split('\n')
                             .map(l => l.trim())
                             .filter(l => l && !l.startsWith('#'));
                             
                // モード切り替え行の検出
                if (lines.includes('MODE:OR')) {
                    includeMode = 'OR';
                    lines = lines.filter(l => l !== 'MODE:OR');
                } else if (lines.includes('MODE:AND')) {
                    includeMode = 'AND';
                    lines = lines.filter(l => l !== 'MODE:AND');
                }
                
                includes = lines;
            } else {
                const defaultIncludeText = `# ここに記述された文字列がファイルパスに含まれる画像のみを表示します（1行に1つ）\n# デフォルトはすべての単語を含む画像を表示する「AND検索」です。\n# どれか一つでも含むものを表示する「OR検索」に切り替えたい場合は、ファイル内に MODE:OR と記述してください。\n\n# 例:\nanime\nsummer\n`;
                fs.writeFileSync(INCLUDE_FILE, defaultIncludeText, 'utf-8');
            }
            
            if (fs.existsSync(EXCLUDE_FILE)) {
                excludes = fs.readFileSync(EXCLUDE_FILE, 'utf-8')
                             .split('\n')
                             .map(l => l.trim())
                             .filter(l => l && !l.startsWith('#'));
            } else {
                fs.writeFileSync(EXCLUDE_FILE, '# ここに記述された文字列がファイルパスに含まれる画像を除外します（1行に1つ）\n# 例: thumbnail\n', 'utf-8');
            }
        } catch(e) {
            console.error('Error reading filter files:', e);
        }

        let allImages = [];
        for (const target of folders) {
            let images = getImagesFromPath(target);
            
            // フィルタの適用
            images = images.filter(imgPath => {
                // パスの大文字小文字を区別せずに判定
                const pathLower = imgPath.toLowerCase(); 
                
                // includes対象（ホワイトリスト）の判定
                if (includes.length > 0) {
                    if (includeMode === 'AND') {
                        // AND: リストに書かれた文字列が「すべて」パスに含まれている必要がある
                        const matchInclude = includes.every(inc => pathLower.includes(inc.toLowerCase()));
                        if (!matchInclude) return false;
                    } else {
                        // OR: どれか一つでも含まれていればOK
                        const matchInclude = includes.some(inc => pathLower.includes(inc.toLowerCase()));
                        if (!matchInclude) return false;
                    }
                }
                
                // excludes対象（ブラックリスト）の判定：一つでも含まれていたらNG
                if (excludes.length > 0) {
                    const matchExclude = excludes.some(exc => pathLower.includes(exc.toLowerCase()));
                    if (matchExclude) return false;
                }
                
                return true;
            });

            allImages = allImages.concat(images);
        }

        if (sortMode === 'asc') {
            allImages.sort((a, b) => a.localeCompare(b));
        } else {
            // Shuffle (Fisher-Yates)
            for (let i = allImages.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [allImages[i], allImages[j]] = [allImages[j], allImages[i]];
            }
        }

        const limitImages = sortMode === 'asc' ? allImages : allImages.slice(0, 1000);
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
        
        if (imgPath) {
            // ZIP内の仮想パスかどうかを判定
            const isZipEntry = imgPath.includes('|');
            const actualExt = isZipEntry ? path.extname(imgPath.split('|')[1]).toLowerCase() : path.extname(imgPath).toLowerCase();
            
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
                const [zipPath, entryName] = imgPath.split('|');
                if (fs.existsSync(zipPath)) {
                    try {
                        const zip = new AdmZip(zipPath);
                        const buffer = zip.readFile(entryName); // メモリ上で伸長・展開
                        if (buffer) {
                            res.writeHead(200, headers);
                            res.end(buffer); // メモリ上のバッファを直接レスポンスするためHDD消費なし
                            return;
                        }
                    } catch (e) {
                        console.error('Error extracting from zip:', e.message);
                    }
                }
            } else if (fs.existsSync(imgPath)) {
                // 通常のファイル提供ストリーミングフロー
                res.writeHead(200, headers);
                const stream = fs.createReadStream(imgPath);
                stream.pipe(res);
                return;
            }
        }
        
        res.writeHead(404);
        res.end('Image not found');
        return;
    }

    // Serve static files from 'public' directory
    let filePath = path.join(__dirname, '..', 'public', reqUrl.pathname === '/' ? 'index.html' : reqUrl.pathname);
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
    console.log(`Please edit the 'folders.txt' file in the 'config' directory`);
    console.log(`to add or change the target image folders.`);
    console.log(`=========================================`);
});
