const fs = require('fs');

let code = fs.readFileSync('public/js/gallery-view.js', 'utf8');

const targetStr = `
        for (let i = currentIndex; i < max; i++) {
            const img = document.createElement('img');
            img.dataset.index = i;

            img.onload = () => {
                let shortestIdx = 0;
                let minH = columnHeights[0];

                for (let j = 1; j < columnCount; j++) {
                    if (columnHeights[j] < minH) {
                        shortestIdx = j;
                        minH = columnHeights[j];
                    }
                }

                const shortestCol = columns[shortestIdx];
                shortestCol.appendChild(img);

                // Estimate height based on aspect ratio to update columnHeights immediately
                // This prevents subsequent images from all being assigned to the same column
                const ratio = img.naturalHeight / img.naturalWidth;
                const colWidth = shortestCol.offsetWidth || (window.innerWidth / columnCount);
                columnHeights[shortestIdx] += (colWidth * ratio);

                setTimeout(() => {
                    img.classList.add('loaded');
                }, 10);

                pendingImages--;
            };

            img.onerror = () => { pendingImages--; };
            img.src = allImagesUrls[i];
        }

        currentIndex = max;
`;

const replaceStr = `
        const batchImages = [];
        let loadedCount = 0;
        const totalInBatch = max - currentIndex;

        // すべての画像を一度に並列で読み込み開始しつつ、表示順序はインデックス順を厳密に守る。
        // これにより、フォルダスキップ時などに先頭の画像が正しい位置（一番上）に表示される。
        for (let i = currentIndex; i < max; i++) {
            const img = document.createElement('img');
            img.dataset.index = i;

            const obj = { img, loaded: false, error: false };
            batchImages.push(obj);

            img.onload = () => {
                obj.loaded = true;
                processBatchQueue();
            };

            img.onerror = () => {
                obj.loaded = true;
                obj.error = true;
                processBatchQueue();
            };

            img.src = allImagesUrls[i];
        }

        // バッチ内で順序通りにDOMへ追加していくためのポインタ
        let nextToPlace = 0;

        function processBatchQueue() {
            while (nextToPlace < totalInBatch && batchImages[nextToPlace].loaded) {
                const currentObj = batchImages[nextToPlace];
                if (!currentObj.error) {
                    const img = currentObj.img;

                    let shortestIdx = 0;
                    let minH = columnHeights[0];

                    for (let j = 1; j < columnCount; j++) {
                        if (columnHeights[j] < minH) {
                            shortestIdx = j;
                            minH = columnHeights[j];
                        }
                    }

                    const shortestCol = columns[shortestIdx];
                    shortestCol.appendChild(img);

                    const ratio = img.naturalHeight / img.naturalWidth;
                    const colWidth = shortestCol.offsetWidth || (window.innerWidth / columnCount);
                    columnHeights[shortestIdx] += (colWidth * ratio);

                    // DOMに追加されてからフェードインさせるため、少し遅延を入れる
                    setTimeout(() => {
                        img.classList.add('loaded');
                    }, 10);
                }
                pendingImages--;
                nextToPlace++;
            }
        }

        currentIndex = max;
`;

code = code.replace(targetStr.trim(), replaceStr.trim());
fs.writeFileSync('public/js/gallery-view.js', code);

console.log("Patched.");
