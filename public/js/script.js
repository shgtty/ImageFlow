/**
 * ImageFlow Main Controller
 * Orchestrates mode selection and common UI.
 */
document.addEventListener('DOMContentLoaded', () => {
    // --- Common Elements ---
    // --- Common Elements ---
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
    const colPlusBtn = document.getElementById('colPlusBtn');
    
    // Dual-View specific control buttons
    const dirBtn = document.getElementById('dirBtn');
    const dirBtnWrapper = document.getElementById('dirBtnWrapper');
    const dirIcon = document.getElementById('dirIcon');

    // --- State Management ---
    const STORAGE_KEY_MODE = 'imageflow_display_mode'; // 'gallery' or 'dual'
    const STORAGE_KEY_GALLERY_SORT = 'imageflow_gallery_sort';
    const STORAGE_KEY_DUAL_SORT = 'imageflow_dual_sort';
    const STORAGE_KEY_DUAL_INTERVAL = 'imageflow_dual_interval';
    const STORAGE_KEY_DUAL_RTL = 'imageflow_dual_rtl';

    let allImagesUrls = [];
    let gallerySortMode = localStorage.getItem(STORAGE_KEY_GALLERY_SORT) || 'random';
    let dualSortMode = localStorage.getItem(STORAGE_KEY_DUAL_SORT) || 'random';
    let dualInterval = parseFloat(localStorage.getItem(STORAGE_KEY_DUAL_INTERVAL)) || 0;
    let lastActiveDualInterval = 5; 
    if (dualInterval > 0) lastActiveDualInterval = dualInterval;

    // --- Initialization ---
    if (typeof DualView !== 'undefined') DualView.init();
    if (typeof GalleryView !== 'undefined') GalleryView.init();

    updateSortIcon();
    updateModeIcon();
    updateDirIcon();
    
    // Initial RTL setting
    if (typeof DualView !== 'undefined') {
        const isRtl = localStorage.getItem(STORAGE_KEY_DUAL_RTL) === 'true';
        DualView.setDirection(isRtl);
    }
    
    loadImages();

    // --- Functions ---

    function updateSortIcon() {
        const mode = localStorage.getItem(STORAGE_KEY_MODE) || 'gallery';
        const currentSort = mode === 'dual' ? dualSortMode : gallerySortMode;
        if (currentSort === 'asc') {
            // 現在は昇順なので、ランダムへ切替えるためのアイコンを表示
            sortIcon.innerHTML = '<path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>';
            sortBtn.title = 'ランダム順に切替 (R)';
        } else {
            // 現在はランダムなので、昇順(A-Z)へ切替えるためのアイコンを表示
            sortIcon.innerHTML = '<path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z"/>';
            sortBtn.title = '昇順(A-Z)に切替 (R)';
        }
    }

    function updateModeIcon() {
        const mode = localStorage.getItem(STORAGE_KEY_MODE) || 'gallery';
        const modeIcon = document.getElementById('modeIcon');
        
        if (dirBtnWrapper) {
            dirBtnWrapper.style.display = (mode === 'dual') ? 'block' : 'none';
        }

        if (modeIcon) {
            if (mode === 'dual') {
                // デュアルモード中なので、ギャラリーへ切替えるための "G" アイコンを表示
                modeIcon.innerHTML = '<text x="50%" y="72%" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="20" fill="currentColor">G</text>';
                modeBtn.title = 'ギャラリー表示へ切替 (M)';
            } else {
                // ギャラリーモード中なので、デュアルへ切替えるための "D" アイコンを表示
                modeIcon.innerHTML = '<text x="50%" y="72%" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="20" fill="currentColor">D</text>';
                modeBtn.title = 'デュアル表示へ切替 (M)';
            }
        }
    }

    function updateDirIcon() {
        if (!dirIcon) return;
        const isRtl = localStorage.getItem(STORAGE_KEY_DUAL_RTL) === 'true';
        if (isRtl) {
            // 現在は右から(RTL)なので、左から(LTR)へ切り替えるためのアイコンを表示
            dirBtn.title = '左から右へ表示 (O)';
            dirIcon.style.color = '#3498db'; // アクティブ感
        } else {
            // 現在は左から(LTR)なので、右から(RTL)へ切り替えるためのアイコンを表示
            dirBtn.title = '右から左へ表示 (O)';
            dirIcon.style.color = '';
        }
    }

    async function loadImages() {
        const mode = localStorage.getItem(STORAGE_KEY_MODE) || 'gallery';
        const currentSort = mode === 'dual' ? dualSortMode : gallerySortMode;

        try {
            const response = await fetch(`/api/images?sort=${currentSort}`);
            if (!response.ok) throw new Error(`Server status: ${response.status}`);
            const data = await response.json();

            if (data.totalFound === 0) {
                showModeOverlay('画像が見つかりませんでした (folders.txtを確認してください)', '', 0);
                return;
            }

            allImagesUrls = data.images;
            const sortName = currentSort === 'asc' ? '昇順' : 'ランダム';
            const modeName = mode === 'dual' ? 'デュアルビューモード' : 'ギャラリーモード';
            const iconHtml = mode === 'dual' 
                ? '<svg class="mode-icon" viewBox="0 0 24 24"><path d="M4 11h5V5H4v6zm0 7h5v-6H4v6zm6 0h5v-6h10v6zm0-7h5V5h-5v6zm6-6v6h5V5h-5z"/></svg>'
                : '<svg class="mode-icon" viewBox="0 0 24 24"><path d="M4 4h7v7H4zm9 0h7v7h-7zm-9 9h7v7H4zm9 0h7v7h-7z"/></svg>';
            
            showModeOverlay(modeName, sortName, allImagesUrls.length, iconHtml);

            // Startup based on mode
            if (mode === 'dual' && typeof DualView !== 'undefined') {
                DualView.enter(allImagesUrls, 0, dualInterval, handleDualExit);
            } else if (typeof GalleryView !== 'undefined') {
                GalleryView.enter(allImagesUrls, 0, { onEnd: () => loadImages() });
            }
        } catch (error) {
            console.error('Error fetching images:', error);
            showModeOverlay('サーバーと通信できません', '', 0);
        }
    }

    let modeOverlayTimer = null;
    function showModeOverlay(modeName, sortName, count, iconHtml) {
        const overlay = document.getElementById('mode-overlay');
        if (!overlay) return;
        
        const sortPart = sortName ? ` [${sortName}]` : '';
        const countPart = (typeof count === 'number' && count > 0) ? ` [${count}枚]` : '';
        
        overlay.innerHTML = `${iconHtml || ''} <span>${modeName}${sortPart}${countPart}</span>`;
        overlay.classList.add('show');
        
        if (modeOverlayTimer) clearTimeout(modeOverlayTimer);
        modeOverlayTimer = setTimeout(() => {
            overlay.classList.remove('show');
        }, 3000);
    }


    function toggleMode() {
        if (typeof DualView === 'undefined' || typeof GalleryView === 'undefined') return;

        if (GalleryView.isActive) {
            const index = GalleryView.currentIndex;
            GalleryView.exit();
            
            localStorage.setItem(STORAGE_KEY_MODE, 'dual');
            updateSortIcon();
            updateModeIcon();

            const iconHtml = '<svg class="mode-icon" viewBox="0 0 24 24"><path d="M4 11h5V5H4v6zm0 7h5v-6H4v6zm6 0h5v-6h10v6zm0-7h5V5h-5v6zm6-6v6h5V5h-5z"/></svg>';
            showModeOverlay('デュアルビューモード', dualSortMode === 'asc' ? '昇順' : 'ランダム', allImagesUrls.length, iconHtml);

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
        updateModeIcon();
        
        const iconHtml = '<svg class="mode-icon" viewBox="0 0 24 24"><path d="M4 4h7v7H4zm9 0h7v7h-7zm-9 9h7v7H4zm9 0h7v7h-7z"/></svg>';
        showModeOverlay('ギャラリーモード', gallerySortMode === 'asc' ? '昇順' : 'ランダム', allImagesUrls.length, iconHtml);

        if (gallerySortMode !== dualSortMode) {
            loadImages();
        } else {
            GalleryView.enter(allImagesUrls, exitIndex, { onEnd: () => loadImages() });
        }
    }

    function toggleSort() {
        if (DualView.isActive) {
            dualSortMode = (dualSortMode === 'random' ? 'asc' : 'random');
            localStorage.setItem(STORAGE_KEY_DUAL_SORT, dualSortMode);
            updateSortIcon();
            
            fetch(`/api/images?sort=${dualSortMode}`).then(r => r.json()).then(data => {
                allImagesUrls = data.images;
                DualView.updateImagesAndReset(allImagesUrls, 0);
                const iconHtml = '<svg class="mode-icon" viewBox="0 0 24 24"><path d="M4 11h5V5H4v6zm0 7h5v-6H4v6zm6 0h5v-6h10v6zm0-7h5V5h-5v6zm6-6v6h5V5h-5z"/></svg>';
                showModeOverlay('デュアルビューモード', dualSortMode === 'asc' ? '昇順' : 'ランダム', allImagesUrls.length, iconHtml);
            });
        } else {
            gallerySortMode = (gallerySortMode === 'random' ? 'asc' : 'random');
            localStorage.setItem(STORAGE_KEY_GALLERY_SORT, gallerySortMode);
            updateSortIcon();
            loadImages();
        }
    }

    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(console.error);
        } else {
            if (document.exitFullscreen) document.exitFullscreen();
        }
    }

    function toggleDirection() {
        if (!DualView.isActive) return;
        const newState = DualView.toggleDirection();
        localStorage.setItem(STORAGE_KEY_DUAL_RTL, newState);
        updateDirIcon();
        const dirText = newState ? '右から左へ' : '左から右へ';
        showModeOverlay('表示順変更', dirText, null, '<svg class="mode-icon" viewBox="0 0 24 24"><path d="M19 15l-3.5-3.5L14 13l2.5 2.5H5v2h11.5L14 20l1.5 1.5L19 18v-3zM5 9l3.5 3.5L10 11 7.5 8.5H19v-2H7.5L10 4 8.5 2.5 5 6v3z"/></svg>');
    }

    // --- Global Event Listeners ---

    reloadBtn.addEventListener('click', () => loadImages());
    modeBtn.addEventListener('click', toggleMode);
    sortBtn.addEventListener('click', toggleSort);
    fullscreenBtn.addEventListener('click', toggleFullscreen);
    dirBtn.addEventListener('click', toggleDirection);

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
        } else if (e.key === 'o' || e.key === 'O') {
            toggleDirection();
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
                DualView.prev(1);
            } else if (GalleryView.isActive) {
                GalleryView.changeColumnCount(-1);
            }
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            if (DualView.isActive) {
                DualView.next(1);
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
        } else if (e.key === 'Home') {
            if (DualView.isActive) {
                e.preventDefault();
                DualView.goToFirst();
            }
        } else if (e.key === 'End') {
            if (DualView.isActive) {
                e.preventDefault();
                DualView.goToLast();
            }
        } else if (e.key === 'PageUp') {
            e.preventDefault();
            skipFolder(-1);
        } else if (e.key === 'PageDown') {
            e.preventDefault();
            skipFolder(1);
        }
    });

    function getFolderPath(url) {
        try {
            const urlObj = new URL(url, window.location.origin);
            const pathStr = urlObj.searchParams.get('path');
            if (!pathStr) return '';
            
            if (pathStr.includes('|')) {
                return pathStr.split('|')[0];
            }
            
            const lastSlash = Math.max(pathStr.lastIndexOf('/'), pathStr.lastIndexOf('\\'));
            if (lastSlash >= 0) {
                return pathStr.substring(0, lastSlash);
            }
            return pathStr;
        } catch (e) {
            return '';
        }
    }

    function getFolderDisplayName(url) {
        let pathStr = getFolderPath(url);
        if (!pathStr) return '不明なフォルダ';
        const parts = pathStr.split(/[/\\]/);
        return parts[parts.length - 1] || pathStr;
    }

    function skipFolder(direction) {
        const mode = localStorage.getItem(STORAGE_KEY_MODE) || 'gallery';
        const currentSort = mode === 'dual' ? dualSortMode : gallerySortMode;
        
        if (currentSort !== 'asc') {
            showModeOverlay('フォルダスキップは昇順(A-Z)ソート時のみ有効です', '', 0);
            return;
        }
        
        if (allImagesUrls.length === 0) return;
        
        let currentIndex = 0;
        if (mode === 'dual' && typeof DualView !== 'undefined' && DualView.isActive) {
            currentIndex = DualView.currentIndex;
        } else if (mode === 'gallery' && typeof GalleryView !== 'undefined' && GalleryView.isActive) {
            currentIndex = GalleryView.currentIndex;
        } else {
            return;
        }
        
        const currentFolder = getFolderPath(allImagesUrls[currentIndex]);
        let targetIndex = currentIndex;
        
        if (direction > 0) {
            // Next folder
            for (let i = currentIndex + 1; i < allImagesUrls.length; i++) {
                if (getFolderPath(allImagesUrls[i]) !== currentFolder) {
                    targetIndex = i;
                    break;
                }
            }
            if (targetIndex === currentIndex) {
                targetIndex = 0; // loop back to first
            }
        } else {
            // Previous folder
            let startOfCurrent = currentIndex;
            while (startOfCurrent > 0 && getFolderPath(allImagesUrls[startOfCurrent - 1]) === currentFolder) {
                startOfCurrent--;
            }
            
            if (currentIndex > startOfCurrent) {
                targetIndex = startOfCurrent;
            } else {
                if (startOfCurrent > 0) {
                    const prevFolder = getFolderPath(allImagesUrls[startOfCurrent - 1]);
                    targetIndex = startOfCurrent - 1;
                    while (targetIndex > 0 && getFolderPath(allImagesUrls[targetIndex - 1]) === prevFolder) {
                        targetIndex--;
                    }
                } else {
                    const lastFolder = getFolderPath(allImagesUrls[allImagesUrls.length - 1]);
                    targetIndex = allImagesUrls.length - 1;
                    while (targetIndex > 0 && getFolderPath(allImagesUrls[targetIndex - 1]) === lastFolder) {
                        targetIndex--;
                    }
                }
            }
        }
        
        const folderName = getFolderDisplayName(allImagesUrls[targetIndex]);
        showModeOverlay('フォルダ移動', folderName, null, '<svg class="mode-icon" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>');

        if (mode === 'dual') {
            DualView.updateImagesAndReset(allImagesUrls, targetIndex);
        } else if (mode === 'gallery') {
            GalleryView.updateImagesAndReset(allImagesUrls, targetIndex, { restoreSpeed: false });
            window.scrollTo(0, 0);
        }
    }

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
