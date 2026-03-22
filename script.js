document.addEventListener('DOMContentLoaded', () => {
    const gallery = document.getElementById('gallery');
    const status = document.getElementById('status');
    const statusBar = document.getElementById('status-bar');
    const reloadBtn = document.getElementById('reloadBtn');
    
    let statusTimeout = null;

    // スクロール用UI
    const scrollUpBtn = document.getElementById('scrollUpBtn');
    const scrollDownBtn = document.getElementById('scrollDownBtn');
    const stopBtn = document.getElementById('stopBtn');
    const speedIndicator = document.getElementById('speed-indicator');

    let scrollSpeed = 0;
    let isScrolling = false;
    let indicatorTimeout = null;
    let savedSpeedForPause = 0;
    let isPaused = false;

    // DOM遅延描画用
    let allImagesUrls = [];
    let currentIndex = 0;
    const BATCH_SIZE = 15;
    let columns = [];
    let columnCount = 3;
    let pendingImages = 0;

    // 次の画像バッチをDOMに追加する関数
    function renderNextBatch(count = BATCH_SIZE) {
        if (currentIndex >= allImagesUrls.length) return;

        const max = Math.min(currentIndex + count, allImagesUrls.length);
        pendingImages += (max - currentIndex);

        for (let i = currentIndex; i < max; i++) {
            const img = document.createElement('img');
            img.dataset.index = i; // 並び替えリセット用に順序を保持
            
            // 画像のロードが完了して「本来の高さ」が確定した段階で、
            // その時点で最も高さが短いカラムを算出してDOMに追加する
            img.onload = () => { 
                let shortestCol = columns[0];
                let minHeight = shortestCol.offsetHeight;
                
                for (let j = 1; j < columnCount; j++) {
                    if (columns[j].offsetHeight < minHeight) {
                        shortestCol = columns[j];
                        minHeight = columns[j].offsetHeight;
                    }
                }
                
                shortestCol.appendChild(img);
                
                // CSSのopacityアニメーションを確実に効かせるための微小ディレイ
                setTimeout(() => {
                    img.classList.add('loaded'); 
                }, 10);
                
                pendingImages--; // 待機カウントを減らす
            };
            
            img.onerror = () => { pendingImages--; }; // エラー時も減らす
            
            // srcを設定して画像のロードを開始
            img.src = allImagesUrls[i];
        }
        
        currentIndex = max;
    }

    // 画像読み込み処理
    async function loadImages(keepState = false) {
        const shouldKeepState = keepState === true;
        let savedSpeed = scrollSpeed;

        if (statusTimeout) clearTimeout(statusTimeout);
        statusBar.style.opacity = '1'; // 読み込み開始時に再度表示
        
        status.textContent = '読み込み中... 少しお待ちください。';
        gallery.innerHTML = ''; // ギャラリーをクリア
        
        if (!shouldKeepState) {
            // 通常のリロード時はスクロール速度をリセット
            scrollSpeed = 0;
            isScrolling = false;
        }
        window.scrollTo(0, 0);
        
        try {
            const response = await fetch('/api/images');
            if (!response.ok) {
                throw new Error(`Server status: ${response.status}`);
            }
            const data = await response.json();
            
            if (data.totalFound === 0) {
                status.innerHTML = `画像が見つかりませんでした。<br><strong>folders.txt</strong> を確認してください。(現在の指定先: ${data.foldersUsed.join(', ') || 'なし'})`;
                return;
            }

            status.textContent = `全 ${data.totalFound} 枚中、ランダムに ${data.count} 枚を表示中`;
            
            // 3秒後にフェードアウトさせる
            statusTimeout = setTimeout(() => {
                statusBar.style.opacity = '0';
            }, 3000);

            // 取得したURLリストをメモリに保持
            allImagesUrls = data.images;
            currentIndex = 0;
            pendingImages = 0;

            // 論理的なカラム用の枠組みを作る
            columns = [];
            for (let i = 0; i < columnCount; i++) {
                const col = document.createElement('div');
                col.className = 'gallery-col';
                columns.push(col);
                gallery.appendChild(col);
            }

            // 初回表示分だけDOMを一気に描画（画面がいっぱいになる少し多めの枚数）
            renderNextBatch(30);

            // 自動ループの場合、ロード完了後にスクロールを再開
            if (shouldKeepState && savedSpeed !== 0) {
                // DOM描画を確実に待つために少し遅延させる
                requestAnimationFrame(() => {
                    scrollSpeed = savedSpeed;
                    if (!isScrolling) {
                        isScrolling = true;
                        autoScroll();
                    }
                });
            }
        } catch (error) {
            console.error('Error fetching images:', error);
            status.textContent = 'サーバーと通信できません。「node server.js」が実行されているか確認してください。';
        }
    }

    reloadBtn.addEventListener('click', loadImages);

    // 初回読み込み
    loadImages();

    // -- オートスクロール制御 --

    function updateSpeedIndicator() {
        if (isPaused) {
            speedIndicator.textContent = `Speed: || Paused`;
        } else {
            const direction = scrollSpeed > 0 ? '▼' : (scrollSpeed < 0 ? '▲' : '■');
            speedIndicator.textContent = `Speed: ${direction} ${Math.abs(scrollSpeed).toFixed(1)}`;
        }
        speedIndicator.style.opacity = '1';

        if (indicatorTimeout) clearTimeout(indicatorTimeout);
        indicatorTimeout = setTimeout(() => {
            speedIndicator.style.opacity = '0';
        }, 1500);
    }

    function autoScroll() {
        if (scrollSpeed !== 0) {
            window.scrollBy({ top: scrollSpeed, left: 0, behavior: 'instant' });
            
            const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
            
            // もし画像リストが残っていて、下端から約2000pxまできたら次のバッチを遅延描画する (前の描画完了を待つ)
            if (currentIndex < allImagesUrls.length && pendingImages < BATCH_SIZE && window.scrollY >= maxScroll - 2000) {
                renderNextBatch(BATCH_SIZE);
            }

            // 境界チェック：一番上または一番下に行ったら止める
            if (window.scrollY <= 0 && scrollSpeed < 0) {
                scrollSpeed = 0; // 上端で停止
            } else if (currentIndex >= allImagesUrls.length && window.scrollY >= maxScroll - 1 && scrollSpeed > 0) {
                // 全ての画像を出し切り、本当の下端に達したらループリロード
                isScrolling = false;
                loadImages(true); 
                return; // 新しいリロードによってアニメーションが再開されるためここで終了
            }

            if (scrollSpeed !== 0) {
                requestAnimationFrame(autoScroll);
            } else {
                isScrolling = false;
                updateSpeedIndicator();
            }
        } else {
            isScrolling = false;
        }
    }

    function changeColumnCount(delta) {
        const newCount = columnCount + delta;
        if (newCount < 1 || newCount > 10) return; // 1列～10列の間に制限
        
        columnCount = newCount;
        
        // 既存のすべての画像要素を収集
        let existingImages = [];
        columns.forEach(col => {
            existingImages.push(...Array.from(col.children));
        });
        
        // 元の順序に綺麗にソートし直す
        existingImages.sort((a, b) => parseInt(a.dataset.index) - parseInt(b.dataset.index));
        
        // カラム要素をクリアし、新しい数で再生成
        gallery.innerHTML = '';
        columns = [];
        for (let i = 0; i < columnCount; i++) {
            const col = document.createElement('div');
            col.className = 'gallery-col';
            columns.push(col);
            gallery.appendChild(col);
        }
        
        // 収集した全画像を短いカラムを見つけて順次詰め直す（ネットワーク・デコード負荷ゼロ）
        existingImages.forEach(img => {
            let shortestCol = columns[0];
            let minHeight = shortestCol.offsetHeight;
            for (let j = 1; j < columnCount; j++) {
                if (columns[j].offsetHeight < minHeight) {
                    shortestCol = columns[j];
                    minHeight = columns[j].offsetHeight;
                }
            }
            shortestCol.appendChild(img);
        });

        // 変更をインジケーターでUI通知
        speedIndicator.textContent = `Columns: ${columnCount}`;
        speedIndicator.style.opacity = '1';
        if (indicatorTimeout) clearTimeout(indicatorTimeout);
        indicatorTimeout = setTimeout(() => {
            speedIndicator.style.opacity = '0';
        }, 1500);
    }

    function changeScrollSpeed(delta) {
        if (isPaused) {
            isPaused = false;
            scrollSpeed = savedSpeedForPause; // ポーズ状態から復帰して加速
        }

        scrollSpeed += delta;
        
        // 0付近の浮動小数点誤差を補正
        if (Math.abs(scrollSpeed) < 0.1) scrollSpeed = 0;
        
        updateSpeedIndicator();

        if (scrollSpeed !== 0 && !isScrolling) {
            isScrolling = true;
            requestAnimationFrame(autoScroll);
        }
    }

    // 上スクロール（マイナス方向へ加速）
    scrollUpBtn.addEventListener('click', () => changeScrollSpeed(-1));
    
    // 下スクロール（プラス方向へ加速）
    scrollDownBtn.addEventListener('click', () => changeScrollSpeed(1));
    
    // 停止
    stopBtn.addEventListener('click', () => {
        isPaused = false; // 停止を確定させたためポーズも解除
        scrollSpeed = 0;
        isScrolling = false;
        updateSpeedIndicator();
    });

    // キーボード操作（Fキーでフルスクリーン、上下キーで速度変更）
    document.addEventListener('keydown', (e) => {
        // 入力中の誤爆を防ぐ場合は対象要素を絞るが、今回は入力欄がないためシンプルに実装
        if (e.key === 'f' || e.key === 'F') {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => {
                    console.error('フルスクリーンへの切り替えに失敗しました:', err);
                });
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                }
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault(); // デフォルトのスクロールを無効化
            changeScrollSpeed(-1);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault(); // デフォルトのスクロールを無効化
            changeScrollSpeed(1);
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            changeColumnCount(-1); // 列を減らす (画像を大きく)
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            changeColumnCount(1); // 列を増やす (画像を小さく)
        } else if (e.key === ' ' || e.code === 'Space') {
            e.preventDefault(); // デフォルトのページ一括スクロールを無効化
            
            if (!isPaused) {
                // スクロール中なら一時停止する
                if (scrollSpeed !== 0) {
                    savedSpeedForPause = scrollSpeed;
                    scrollSpeed = 0;
                    isPaused = true;
                    updateSpeedIndicator();
                }
            } else {
                // 一時停止中なら元の速度で再開する
                isPaused = false;
                scrollSpeed = savedSpeedForPause;
                updateSpeedIndicator();
                
                if (scrollSpeed !== 0 && !isScrolling) {
                    isScrolling = true;
                    requestAnimationFrame(autoScroll);
                }
            }
        }
    });

    // マウススクロール（手動）用にも遅延読み込み発火を監視
    window.addEventListener('scroll', () => {
        const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        if (currentIndex < allImagesUrls.length && pendingImages < BATCH_SIZE && window.scrollY >= maxScroll - 2000) {
            renderNextBatch(BATCH_SIZE);
        }
    }, { passive: true });

    // --- UIの自動非表示・表示制御 ---
    const fabContainer = document.getElementById('fab-container');
    let activityTimeout = null;

    function resetActivityTimer() {
        // 操作があれば即座に表示
        fabContainer.classList.remove('hidden');
        document.body.classList.remove('hide-cursor'); // カーソルを再表示
        
        // 既存のタイマーをリセット
        if (activityTimeout) clearTimeout(activityTimeout);
        
        // 3秒後に非表示にするタイマーをセット
        activityTimeout = setTimeout(() => {
            fabContainer.classList.add('hidden');
            document.body.classList.add('hide-cursor'); // マウスカーソルも一緒に隠す
        }, 3000);
    }

    // 監視するユーザー操作のイベント一覧
    // （注：'scroll' イベントはオートスクロール中にも自動で毎フレーム発火してしまうため監視から外し、'wheel'等の手動操作のみ検知）
    const activityEvents = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'wheel'];
    activityEvents.forEach(eventType => {
        window.addEventListener(eventType, resetActivityTimer, { passive: true });
    });

    // 初回起動時もタイマーをスタート
    resetActivityTimer();
});
