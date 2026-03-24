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
    const colMinusBtn = document.getElementById('colMinusBtn');
    const colPlusBtn = document.getElementById('colPlusBtn');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const fullscreenIcon = document.getElementById('fullscreenIcon');
    const modeBtn = document.getElementById('modeBtn');

    // DualView の初期化
    if (typeof DualView !== 'undefined') DualView.init();

    // -- 永続化用のキー --
    const STORAGE_KEY_SPEED = 'imageflow_scroll_speed';
    const STORAGE_KEY_COLUMNS = 'imageflow_column_count';
    const STORAGE_KEY_MODE = 'imageflow_display_mode'; // 'gallery' or 'dual'
    const STORAGE_KEY_DUAL_INTERVAL = 'imageflow_dual_interval'; // Seconds

    let scrollSpeed = parseFloat(localStorage.getItem(STORAGE_KEY_SPEED)) || 0;
    let dualInterval = parseFloat(localStorage.getItem(STORAGE_KEY_DUAL_INTERVAL)) || 0;
    let isScrolling = false;
    let indicatorTimeout = null;
    let savedSpeedForPause = 0;
    let isPaused = false;

    // DOM遅延描画用
    let allImagesUrls = [];
    let currentIndex = 0;
    const BATCH_SIZE = 15;
    let columns = [];
    let columnCount = parseInt(localStorage.getItem(STORAGE_KEY_COLUMNS)) || 3;
    // 範囲のバリデーション
    if (columnCount < 1) columnCount = 1;
    if (columnCount > 10) columnCount = 10;
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
            isScrolling = false;
        }
        window.scrollTo(0, 0);
        
        try {
            let data;
            if (shouldKeepState && allImagesUrls.length > 0) {
                // すでにデータがある場合はフェッチをスキップして再構築のみ行う
                data = {
                    totalFound: allImagesUrls.length,
                    count: allImagesUrls.length,
                    images: allImagesUrls,
                    foldersUsed: [] 
                };
            } else {
                const response = await fetch('/api/images');
                if (!response.ok) {
                    throw new Error(`Server status: ${response.status}`);
                }
                data = await response.json();
            }
            
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

            // ロード完了後に（速度が設定されていれば）スクロールを開始
            if (savedSpeed !== 0) {
                // DOM描画を確実に待つために少し遅延させる
                requestAnimationFrame(() => {
                    scrollSpeed = savedSpeed;
                    if (!isScrolling) {
                        isScrolling = true;
                        autoScroll();
                    }
                });
            }

            // モードの復元（前回復帰時がDualモードだった場合）
            if (localStorage.getItem(STORAGE_KEY_MODE) === 'dual') {
                // 少しだけDOM構築を待ってから移行
                setTimeout(() => {
                    if (!DualView.isActive) {
                        toggleMode(0, dualInterval); // 保存された秒数で開始
                    }
                }, 100);
            }
        } catch (error) {
            console.error('Error fetching images:', error);
            status.textContent = 'サーバーと通信できません。「node server.js」が実行されているか確認してください。';
        }
    }

    // 表示モード切替
    function toggleMode(forcedIndex = null, forcedInterval = null) {
        if (typeof DualView === 'undefined') return;

        if (!DualView.isActive) {
            let startIndex = 0;
            let startInterval = forcedInterval !== null ? forcedInterval : dualInterval;

            if (forcedIndex !== null) {
                startIndex = forcedIndex;
            } else {
                // 現在画面中央付近に見えている画像のインデックスを取得してそこから開始
                const imagesInGallery = Array.from(gallery.querySelectorAll('img'));
                const viewportMiddle = window.innerHeight / 2;
                let closestImg = imagesInGallery[0];
                let minDistance = Infinity;
                
                imagesInGallery.forEach(img => {
                    const rect = img.getBoundingClientRect();
                    const distance = Math.abs((rect.top + rect.bottom) / 2 - viewportMiddle);
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestImg = img;
                    }
                });

                if (closestImg) {
                    startIndex = parseInt(closestImg.dataset.index);
                } else {
                    startIndex = Math.max(0, currentIndex - BATCH_SIZE);
                }
            }

            // スクロールを一時停止
            if (isScrolling || scrollSpeed !== 0) {
                savedSpeedForPause = scrollSpeed;
                scrollSpeed = 0;
                isScrolling = false;
                updateSpeedIndicator();
            }

            localStorage.setItem(STORAGE_KEY_MODE, 'dual');
            DualView.enter(allImagesUrls, startIndex, startInterval, (exitIndex) => {
                // 終了時の処理（必要に応じて位置を調整など）
                localStorage.setItem(STORAGE_KEY_MODE, 'gallery');
                
                // スクロール速度を復元
                if (scrollSpeed === 0 && savedSpeedForPause !== 0) {
                    scrollSpeed = savedSpeedForPause;
                }

                loadImages(true); 
                status.textContent = "通常のギャラリー表示に戻りました";
                statusBar.style.opacity = '1';
                setTimeout(() => statusBar.style.opacity = '0', 2000);
            });
        } else {
            DualView.exit();
        }
    }

    modeBtn.addEventListener('click', toggleMode);

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
        if (typeof DualView !== 'undefined' && DualView.isActive) {
            isScrolling = false;
            return;
        }
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
        localStorage.setItem(STORAGE_KEY_COLUMNS, columnCount);
        
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
        if (DualView.isActive) {
            // Dual View モードでの秒数増減
            // 下キー (delta > 0) で速く (秒数減)、上キー (delta < 0) で遅く (秒数増)
            if (dualInterval === 0 && delta > 0) {
                dualInterval = 5; // 最初は5秒から
            } else if (dualInterval > 0) {
                // 逆方向に送りたい場合は一旦停止か、秒数を増やす
                if (delta > 0) {
                    dualInterval = Math.max(1, dualInterval - 1); // 最速1秒
                } else {
                    dualInterval += 1;
                }
            } else if (delta < 0) {
                // 停止中に上を押した場合も5秒から
                dualInterval = 5;
            }
            
            localStorage.setItem(STORAGE_KEY_DUAL_INTERVAL, dualInterval);
            DualView.setAutoAdvance(dualInterval);
            return;
        }

        if (isPaused) {
            isPaused = false;
            scrollSpeed = savedSpeedForPause;
        }

        scrollSpeed += delta;
        
        // 0付近の浮動小数点誤差を補正
        if (Math.abs(scrollSpeed) < 0.1) scrollSpeed = 0;
        
        localStorage.setItem(STORAGE_KEY_SPEED, scrollSpeed);
        
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
        if (DualView.isActive) {
            dualInterval = 0;
            localStorage.setItem(STORAGE_KEY_DUAL_INTERVAL, dualInterval);
            DualView.stop();
            return;
        }

        isPaused = false; // 停止を確定させたためポーズも解除
        scrollSpeed = 0;
        localStorage.setItem(STORAGE_KEY_SPEED, scrollSpeed);
        isScrolling = false;
        updateSpeedIndicator();
    });

    // 列数変更
    colMinusBtn.addEventListener('click', () => changeColumnCount(-1));
    colPlusBtn.addEventListener('click', () => changeColumnCount(1));

    // フルスクリーン切り替え
    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error('フルスクリーンへの切り替えに失敗しました:', err);
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    }

    fullscreenBtn.addEventListener('click', toggleFullscreen);

    // フルスクリーンの状態変化を監視してアイコンを切り替える
    document.addEventListener('fullscreenchange', () => {
        if (document.fullscreenElement) {
            // Exit fullscreen icon
            fullscreenIcon.innerHTML = '<path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>';
        } else {
            // Enter fullscreen icon
            fullscreenIcon.innerHTML = '<path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>';
        }
    });

    // キーボード操作（Fキーでフルスクリーン、上下キーで速度変更）
    document.addEventListener('keydown', (e) => {
        // 入力中の誤爆を防ぐ場合は対象要素を絞るが、今回は入力欄がないためシンプルに実装
        if (e.key === 'm' || e.key === 'M') {
            toggleMode();
        } else if (e.key === 'f' || e.key === 'F') {
            toggleFullscreen();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            changeScrollSpeed(-1);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            changeScrollSpeed(1);
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            if (DualView.isActive) {
                DualView.prev();
            } else {
                changeColumnCount(-1);
            }
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            if (DualView.isActive) {
                DualView.next();
            } else {
                changeColumnCount(1);
            }
        } else if (e.key === 'Escape') {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                window.close();
            }
        } else if (e.key === ' ' || e.code === 'Space') {
            e.preventDefault(); // デフォルトのページ一括スクロールを無効化
            
            if (DualView.isActive) {
                DualView.togglePause();
                return;
            }

            if (!isPaused) {
                // スクロール中なら一時停止する
                if (scrollSpeed !== 0) {
                    savedSpeedForPause = scrollSpeed;
                    scrollSpeed = 0;
                    localStorage.setItem(STORAGE_KEY_SPEED, scrollSpeed);
                    isPaused = true;
                    updateSpeedIndicator();
                }
            } else {
                // 一時停止中なら元の速度で再開する
                isPaused = false;
                scrollSpeed = savedSpeedForPause;
                localStorage.setItem(STORAGE_KEY_SPEED, scrollSpeed);
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
        document.documentElement.classList.remove('hide-cursor');
        
        // 既存のタイマーをリセット
        if (activityTimeout) clearTimeout(activityTimeout);
        
        // 3秒後に非表示にするタイマーをセット
        activityTimeout = setTimeout(() => {
            fabContainer.classList.add('hidden');
            document.documentElement.classList.add('hide-cursor');
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
