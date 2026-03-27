/**
 * ImageFlow Main Controller
 * Orchestrates mode selection and common UI.
 */
document.addEventListener('DOMContentLoaded', () => {
    // --- Common Elements ---
    const status = document.getElementById('status');
    const statusBar = document.getElementById('status-bar');
    const reloadBtn = document.getElementById('reloadBtn');
    const modeBtn = document.getElementById('modeBtn');
    const sortBtn = document.getElementById('sortBtn');
    const sortIcon = document.getElementById('sortIcon');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const fullscreenIcon = document.getElementById('fullscreenIcon');
    
    // Gallery specific control buttons
    const scrollUpBtn = document.getElementById('scrollUpBtn');
    const scrollDownBtn = document.getElementById('scrollDownBtn');
    const stopBtn = document.getElementById('stopBtn');
    const colMinusBtn = document.getElementById('colMinusBtn');
    const colPlusBtn = document.getElementById('colPlusBtn');

    // --- State Management ---
    const STORAGE_KEY_MODE = 'imageflow_display_mode'; // 'gallery' or 'dual'
    const STORAGE_KEY_GALLERY_SORT = 'imageflow_gallery_sort';
    const STORAGE_KEY_DUAL_SORT = 'imageflow_dual_sort';
    const STORAGE_KEY_DUAL_INTERVAL = 'imageflow_dual_interval';

    let allImagesUrls = [];
    let gallerySortMode = localStorage.getItem(STORAGE_KEY_GALLERY_SORT) || 'random';
    let dualSortMode = localStorage.getItem(STORAGE_KEY_DUAL_SORT) || 'random';
    let dualInterval = parseFloat(localStorage.getItem(STORAGE_KEY_DUAL_INTERVAL)) || 0;
    // 停止（秒数0）からの復帰用に、有効だった直近の秒数を保持する
    let lastActiveDualInterval = 5; 
    if (dualInterval > 0) lastActiveDualInterval = dualInterval;
    let statusTimeout = null;

    // --- Initialization ---
    if (typeof DualView !== 'undefined') DualView.init();
    if (typeof GalleryView !== 'undefined') GalleryView.init();

    updateSortIcon();
    loadImages();

    // --- Functions ---

    function updateSortIcon() {
        const isActiveDual = (typeof DualView !== 'undefined' && DualView.isActive);
        const mode = isActiveDual ? dualSortMode : gallerySortMode;
        if (mode === 'asc') {
            sortIcon.innerHTML = '<path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z"/>';
            sortBtn.title = 'ソート切替 = 昇順 (R)';
        } else {
            sortIcon.innerHTML = '<path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>';
            sortBtn.title = 'ソート切替 = ランダム (R)';
        }
    }

    async function loadImages() {
        if (statusTimeout) clearTimeout(statusTimeout);
        statusBar.style.opacity = '1';
        status.textContent = '読み込み中... 少しお待ちください。';

        const mode = localStorage.getItem(STORAGE_KEY_MODE) || 'gallery';
        const currentSort = mode === 'dual' ? dualSortMode : gallerySortMode;

        try {
            const response = await fetch(`/api/images?sort=${currentSort}`);
            if (!response.ok) throw new Error(`Server status: ${response.status}`);
            const data = await response.json();

            if (data.totalFound === 0) {
                status.innerHTML = `画像が見つかりませんでした。<br><strong>folders.txt</strong> を確認してください。`;
                return;
            }

            allImagesUrls = data.images;
            status.textContent = `全 ${data.totalFound} 枚中、${currentSort === 'asc' ? '昇順' : 'ランダム'}に ${data.count} 枚を表示中`;
            
            statusTimeout = setTimeout(() => {
                statusBar.style.opacity = '0';
            }, 3000);

            // Startup based on mode
            if (mode === 'dual' && typeof DualView !== 'undefined') {
                DualView.enter(allImagesUrls, 0, dualInterval, handleDualExit);
            } else if (typeof GalleryView !== 'undefined') {
                GalleryView.enter(allImagesUrls, 0, { onEnd: () => loadImages() });
            }
        } catch (error) {
            console.error('Error fetching images:', error);
            status.textContent = 'サーバーと通信できません。';
        }
    }


    function toggleMode() {
        if (typeof DualView === 'undefined' || typeof GalleryView === 'undefined') return;

        if (GalleryView.isActive) {
            const index = GalleryView.currentIndex;
            GalleryView.exit();
            
            localStorage.setItem(STORAGE_KEY_MODE, 'dual');
            updateSortIcon();

            // Check if sort needs to change
            if (gallerySortMode !== dualSortMode) {
                // Fetch for dual mode
                fetch(`/api/images?sort=${dualSortMode}`).then(r => r.json()).then(data => {
                    allImagesUrls = data.images;
                    DualView.enter(allImagesUrls, 0, dualInterval, handleDualExit);
                }).catch(console.error);
            } else {
                DualView.enter(allImagesUrls, index, dualInterval, handleDualExit);
            }
        } else if (DualView.isActive) {
            const index = DualView.currentIndex; // DualView needs an index getter
            DualView.exit();
        }
    }

    function handleDualExit(exitIndex) {
        localStorage.setItem(STORAGE_KEY_MODE, 'gallery');
        updateSortIcon();
        
        if (gallerySortMode !== dualSortMode) {
            loadImages();
        } else {
            GalleryView.enter(allImagesUrls, exitIndex, { onEnd: () => loadImages() });
        }
        
        status.textContent = "通常のギャラリー表示に戻りました";
        statusBar.style.opacity = '1';
        setTimeout(() => statusBar.style.opacity = '0', 2000);
    }

    function toggleSort() {
        if (DualView.isActive) {
            dualSortMode = (dualSortMode === 'random' ? 'asc' : 'random');
            localStorage.setItem(STORAGE_KEY_DUAL_SORT, dualSortMode);
            updateSortIcon();
            
            fetch(`/api/images?sort=${dualSortMode}`).then(r => r.json()).then(data => {
                allImagesUrls = data.images;
                DualView.updateImagesAndReset(allImagesUrls, 0);
                status.textContent = dualSortMode === 'asc' ? '昇順で表示します' : 'ランダム順で表示します';
                statusBar.style.opacity = '1';
                setTimeout(() => statusBar.style.opacity = '0', 2000);
            });
        } else {
            gallerySortMode = (gallerySortMode === 'random' ? 'asc' : 'random');
            localStorage.setItem(STORAGE_KEY_GALLERY_SORT, gallerySortMode);
            updateSortIcon();
            loadImages();
            status.textContent = gallerySortMode === 'asc' ? '昇順で表示します' : 'ランダム順で表示します';
            statusBar.style.opacity = '1';
            setTimeout(() => statusBar.style.opacity = '0', 2000);
        }
    }

    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(console.error);
        } else {
            if (document.exitFullscreen) document.exitFullscreen();
        }
    }

    // --- Global Event Listeners ---

    reloadBtn.addEventListener('click', () => loadImages());
    modeBtn.addEventListener('click', toggleMode);
    sortBtn.addEventListener('click', toggleSort);
    fullscreenBtn.addEventListener('click', toggleFullscreen);

    scrollUpBtn.addEventListener('click', () => {
        if (GalleryView.isActive) {
            GalleryView.changeScrollSpeed(-1);
        } else if (DualView.isActive) {
            changeDualInterval(-1);
        }
    });
    scrollDownBtn.addEventListener('click', () => {
        if (GalleryView.isActive) {
            GalleryView.changeScrollSpeed(1);
        } else if (DualView.isActive) {
            changeDualInterval(1);
        }
    });
    stopBtn.addEventListener('click', () => {
        if (DualView.isActive) {
            // 永続化（保存）だけ 0 にする（次回リロード時に停止で開始するため）
            localStorage.setItem(STORAGE_KEY_DUAL_INTERVAL, 0);
            DualView.stop();
        } else if (GalleryView.isActive) {
            GalleryView.stop();
        }
    });
    colMinusBtn.addEventListener('click', () => {
        if (GalleryView.isActive) GalleryView.changeColumnCount(-1);
    });
    colPlusBtn.addEventListener('click', () => {
        if (GalleryView.isActive) GalleryView.changeColumnCount(1);
    });

    document.addEventListener('fullscreenchange', () => {
        if (document.fullscreenElement) {
            fullscreenIcon.innerHTML = '<path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>';
        } else {
            fullscreenIcon.innerHTML = '<path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>';
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'm' || e.key === 'M') {
            toggleMode();
        } else if (e.key === 'r' || e.key === 'R') {
            toggleSort();
        } else if (e.key === 'f' || e.key === 'F') {
            toggleFullscreen();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (GalleryView.isActive) {
                GalleryView.changeScrollSpeed(-1);
            } else if (DualView.isActive) {
                DualView.prev();
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (GalleryView.isActive) {
                GalleryView.changeScrollSpeed(1);
            } else if (DualView.isActive) {
                DualView.next();
            }
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            if (DualView.isActive) {
                DualView.prev();
            } else if (GalleryView.isActive) {
                GalleryView.changeColumnCount(-1);
            }
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            if (DualView.isActive) {
                DualView.next();
            } else if (GalleryView.isActive) {
                GalleryView.changeColumnCount(1);
            }
        } else if (e.key === 'Escape') {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                window.close();
            }
        } else if (e.key === ' ' || e.code === 'Space') {
            e.preventDefault();
            if (DualView.isActive) {
                if (DualView.interval === 0) {
                    // 停止中からの再開時は、最後に有効だった秒数で再開する
                    dualInterval = lastActiveDualInterval;
                    localStorage.setItem(STORAGE_KEY_DUAL_INTERVAL, dualInterval);
                    DualView.setAutoAdvance(dualInterval);
                } else {
                    DualView.togglePause();
                }
            } else if (GalleryView.isActive) {
                GalleryView.togglePause();
            }
        }
    });

    function changeDualInterval(delta) {
        // 現在のインターバルを取得（停止中なら 0 を返す）
        let current = (typeof DualView !== 'undefined' && DualView.isActive) ? DualView.interval : dualInterval;

        if (current === 0) {
            // 停止中なら、最後に有効だった値をベースにして増減を開始
            dualInterval = lastActiveDualInterval;
        } else {
            dualInterval = current;
        }

        // 変化させる
        if (delta > 0) {
            dualInterval = Math.max(1, dualInterval - 1);
        } else {
            dualInterval += 1;
        }

        lastActiveDualInterval = dualInterval;
        localStorage.setItem(STORAGE_KEY_DUAL_INTERVAL, dualInterval);
        DualView.setAutoAdvance(dualInterval);
    }

    // --- UI Auto-Hide ---
    const fabContainer = document.getElementById('fab-container');
    let activityTimeout = null;
    function resetActivityTimer() {
        fabContainer.classList.remove('hidden');
        document.documentElement.classList.remove('hide-cursor');
        if (activityTimeout) clearTimeout(activityTimeout);
        activityTimeout = setTimeout(() => {
            fabContainer.classList.add('hidden');
            document.documentElement.classList.add('hide-cursor');
        }, 3000);
    }
    ['mousemove', 'keydown', 'mousedown', 'touchstart', 'wheel'].forEach(type => {
        window.addEventListener(type, resetActivityTimer, { passive: true });
    });
    resetActivityTimer();

    window.addEventListener('mousedown', (e) => {
        if (e.button === 1) {
            e.preventDefault();
            toggleFullscreen();
        }
    });
});
