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
    const includeToggleBtn = document.getElementById('includeToggleBtn');
    const includeToggleIcon = document.getElementById('includeToggleIcon');
    const colorModeBtn = document.getElementById('colorModeBtn');
    const cursorTooltipBtn = document.getElementById('cursorTooltipBtn');
    const cursorTooltipIcon = document.getElementById('cursorTooltipIcon');
    const cursorTooltip = document.getElementById('cursor-tooltip');
    
    // File selection UI elements
    const fileSelectBtn = document.getElementById('fileSelectBtn');
    const fileSelectBtnWrapper = document.getElementById('fileSelectBtnWrapper');
    const fileSelectModal = document.getElementById('file-select-modal');
    const closeFileModal = document.getElementById('close-file-modal');
    const fileListContainer = document.getElementById('file-list');

    // Filter modal UI elements
    const filterModal = document.getElementById('filter-modal');
    const filterGlobalEnable = document.getElementById('filter-global-enable');
    const filterModeRadios = document.getElementsByName('filter-mode');
    const filterNewWord = document.getElementById('filter-new-word');
    const filterAddBtn = document.getElementById('filter-add-btn');
    const filterList = document.getElementById('filter-list');
    const closeFilterModalBtn = document.getElementById('close-filter-modal');
    const saveFilterModalBtn = document.getElementById('save-filter-modal');

    // Gallery specific control buttons
    const scrollUpBtn = document.getElementById('scrollUpBtn');
    const scrollDownBtn = document.getElementById('scrollDownBtn');
    const stopBtn = document.getElementById('stopBtn');
    const colMinusBtn = document.getElementById('colMinusBtn');
    const colPlusBtn = document.getElementById('colPlusBtn');
    const colBtnRow = document.getElementById('colBtnRow');

    // Dual-View specific control buttons
    const dirBtn = document.getElementById('dirBtn');
    const dirBtnWrapper = document.getElementById('dirBtnWrapper');
    const dirIcon = document.getElementById('dirIcon');
    const seekbar = document.getElementById('seekbar');
    const seekbarInfo = document.getElementById('seekbar-info');
    const seekbarContainer = document.getElementById('seekbar-container');
    const seekbarTooltip = document.getElementById('seekbar-tooltip');
    const seekbarToggleBtn = document.getElementById('seekbarToggleBtn');
    const seekbarToggleIcon = document.getElementById('seekbarToggleIcon');
    const modeOverlay = document.getElementById('mode-overlay');
    let currentFilterDisplay = ''; 
    let currentModeMessage = '';
    let overlayHideTimer = null;

    let previousFocus = null;

    // --- State Management ---
    const STORAGE_KEY_MODE = 'imageflow_display_mode'; // 'gallery' or 'dual'
    const STORAGE_KEY_GALLERY_SORT = 'imageflow_gallery_sort';
    const STORAGE_KEY_DUAL_SORT = 'imageflow_dual_sort';
    const STORAGE_KEY_DUAL_INTERVAL = 'imageflow_dual_interval';
    const STORAGE_KEY_DUAL_RTL = 'imageflow_dual_rtl';
    const STORAGE_KEY_DUAL_INDEX = 'imageflow_dual_index';
    const STORAGE_KEY_DUAL_SPEED = 'imageflow_dual_speed';
    const STORAGE_KEY_GALLERY_INDEX = 'imageflow_gallery_index';
    const STORAGE_KEY_SEEKBAR_VISIBLE = 'imageflow_seekbar_visible';
    const STORAGE_KEY_ENABLE_INCLUDE = 'imageflow_enable_include';
    const STORAGE_KEY_COLOR_MODE = 'imageflow_color_mode';
    const STORAGE_KEY_CURSOR_TOOLTIP = 'imageflow_cursor_tooltip';

    let isDraggingSeekbar = false;
    let isResetting = false;
    let allImagesUrls = [];
    let enableInclude = localStorage.getItem(STORAGE_KEY_ENABLE_INCLUDE) === 'true';
    let enableCursorTooltip = localStorage.getItem(STORAGE_KEY_CURSOR_TOOLTIP) === 'true';
    let lastMouseX = 0;
    let lastMouseY = 0;
    let lastDualIndex = parseInt(localStorage.getItem(STORAGE_KEY_DUAL_INDEX)) || -1; 
    let gallerySortMode = localStorage.getItem(STORAGE_KEY_GALLERY_SORT) || 'random';
    let dualSortMode = localStorage.getItem(STORAGE_KEY_DUAL_SORT) || 'asc';
    let dualInterval = parseFloat(localStorage.getItem(STORAGE_KEY_DUAL_INTERVAL)) || 0;
    let lastActiveDualInterval = parseFloat(localStorage.getItem(STORAGE_KEY_DUAL_SPEED)) || 10;
    if (dualInterval > 0) lastActiveDualInterval = dualInterval;
    let lastActiveGallerySpeed = parseFloat(localStorage.getItem('imageflow_scroll_speed')) || 2.0;
    if (lastActiveGallerySpeed === 0) lastActiveGallerySpeed = 2.0;

    let currentColorModeIndex = parseInt(localStorage.getItem(STORAGE_KEY_COLOR_MODE)) || 0;

    // --- Initialization ---
    if (typeof DualView !== 'undefined') DualView.init();
    if (typeof GalleryView !== 'undefined') GalleryView.init();

    updateSortIcon();
    updateModeIcon();
    updateDirIcon();

    // Initial RTL setting
    const isRtl = localStorage.getItem(STORAGE_KEY_DUAL_RTL) !== 'false';
    if (typeof DualView !== 'undefined') DualView.setDirection(isRtl);
    if (typeof GalleryView !== 'undefined') GalleryView.setDirection(isRtl);
 
    // Initial Seekbar visibility
    const isSeekbarVisible = localStorage.getItem(STORAGE_KEY_SEEKBAR_VISIBLE) === 'true';
    if (isSeekbarVisible) {
        seekbarContainer.classList.remove('user-hidden');
        if (seekbarToggleIcon) seekbarToggleIcon.style.color = '#3498db';
    }
 
    // Initial Color Mode
    const initColorModes = ['', 'color-mode-gray', 'color-mode-sepia', 'color-mode-invert', 'color-mode-contrast', 'color-mode-saturate', 'color-mode-blur', 'color-mode-pixel', 'color-mode-crt'];
    if (initColorModes[currentColorModeIndex]) {
        document.body.classList.add(initColorModes[currentColorModeIndex]);
    }

    // Initial Cursor Tooltip
    if (cursorTooltipIcon) {
        cursorTooltipIcon.style.color = enableCursorTooltip ? '#3498db' : '';
    }

    updateIncludeIcon();
    loadImages();

    // --- State Persistence ---
    setInterval(() => {
        if (typeof DualView !== 'undefined' && DualView.isActive && dualSortMode === 'asc') {
            localStorage.setItem(STORAGE_KEY_DUAL_INDEX, DualView.currentIndex);
        } else if (typeof GalleryView !== 'undefined' && GalleryView.isActive && gallerySortMode === 'asc') {
            localStorage.setItem(STORAGE_KEY_GALLERY_INDEX, GalleryView.currentIndex);
        }
        updateSeekbar();
    }, 2000);

    // 高頻度な更新（再生中など）
    setInterval(() => {
        if ((typeof DualView !== 'undefined' && DualView.isActive && DualView.interval > 0 && !DualView.isPaused) ||
            (typeof GalleryView !== 'undefined' && GalleryView.isActive && GalleryView.scrollSpeed !== 0 && !GalleryView.isPaused)) {
            updateSeekbar();
            updateCursorTooltipContent();
        }
    }, 500);

    // --- Functions ---

    function updateSortIcon() {
        const mode = localStorage.getItem(STORAGE_KEY_MODE) || 'gallery';
        const currentSort = mode === 'dual' ? dualSortMode : gallerySortMode;
        if (currentSort === 'asc') {
            // 現在は昇順なので、フォルダ単位ランダムへ切替えるためのアイコンを表示
            sortIcon.innerHTML = '<path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" opacity="0.4"/><path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>';
            sortBtn.title = 'フォルダ単位ランダムに切替 (R)';
            sortBtn.setAttribute('aria-label', sortBtn.title);
        } else if (currentSort === 'folder-random') {
            // 現在はフォルダ単位ランダムなので、ランダムへ切替えるためのアイコンを表示
            sortIcon.innerHTML = '<path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>';
            sortBtn.title = 'ランダム順に切替 (R)';
            sortBtn.setAttribute('aria-label', sortBtn.title);
        } else {
            // 現在はランダムなので、昇順(A-Z)へ切替えるためのアイコンを表示
            sortIcon.innerHTML = '<path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z"/>';
            sortBtn.title = '昇順(A-Z)に切替 (R)';
            sortBtn.setAttribute('aria-label', sortBtn.title);
        }
    }

    function updateModeIcon() {
        const mode = localStorage.getItem(STORAGE_KEY_MODE) || 'gallery';
        const modeIcon = document.getElementById('modeIcon');

        if (dirBtnWrapper) {
            dirBtnWrapper.style.display = 'block';
        }

        if (colBtnRow) {
            colBtnRow.style.display = (mode === 'dual') ? 'none' : 'flex';
        }

        if (modeIcon) {
            if (mode === 'dual') {
                // デュアルモード中なので、ギャラリーへ切替えるための "G" アイコンを表示
                modeIcon.innerHTML = '<text x="50%" y="72%" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="20" fill="currentColor">G</text>';
                modeBtn.title = 'ギャラリー表示へ切替 (M)';
                modeBtn.setAttribute('aria-label', modeBtn.title);
            } else {
                // ギャラリーモード中なので、デュアルへ切替えるための "D" アイコンを表示
                modeIcon.innerHTML = '<text x="50%" y="72%" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="20" fill="currentColor">D</text>';
                modeBtn.title = 'デュアル表示へ切替 (M)';
                modeBtn.setAttribute('aria-label', modeBtn.title);
            }
        }
    }

    function updateDirIcon() {
        if (!dirIcon) return;
        const isRtl = localStorage.getItem(STORAGE_KEY_DUAL_RTL) !== 'false';
        if (isRtl) {
            // 現在は右から(RTL)なので、左から(LTR)へ切り替えるためのアイコンを表示
            dirBtn.title = '左から右へ表示 (O)';
            dirBtn.setAttribute('aria-label', dirBtn.title);
            dirIcon.style.color = ''; // 初期値(RTL)は色なし
        } else {
            // 現在は左から(LTR)なので、右から(RTL)へ切り替えるためのアイコンを表示
            dirBtn.title = '右から左へ表示 (O)';
            dirBtn.setAttribute('aria-label', dirBtn.title);
            dirIcon.style.color = '#3498db'; // 変更後(LTR)にアクティブ色
        }
    }

    function handleGalleryEnd() {
        if (typeof GalleryView !== 'undefined') {
            GalleryView.updateImagesAndReset(allImagesUrls, 0, { restoreSpeed: true });
            window.scrollTo(0, 0);
            if (gallerySortMode === 'asc') {
                localStorage.setItem(STORAGE_KEY_GALLERY_INDEX, 0);
            }
        }
        if (gallerySortMode !== 'asc') {
            loadImages();
        }
    }

    async function loadImages() {
        const mode = localStorage.getItem(STORAGE_KEY_MODE) || 'gallery';
        const currentSort = mode === 'dual' ? dualSortMode : gallerySortMode;

        if (reloadBtn) {
            reloadBtn.disabled = true;
            const svg = reloadBtn.querySelector('svg');
            if (svg) svg.classList.add('spin');
        }

        try {
            const response = await fetch(`/api/images?sort=${currentSort}&enableInclude=${enableInclude}`);
            if (!response.ok) throw new Error(`Server status: ${response.status}`);
            const data = await response.json();

            if (fileSelectBtnWrapper) {
                fileSelectBtnWrapper.style.display = data.isConfigDir ? 'block' : 'none';
            }

            if (data.totalFound === 0) {
                allImagesUrls = []; // Clear current list if nothing found
                seekbar.max = 0;
                seekbar.value = 0;
                seekbarInfo.textContent = '0 / 0';
                seekbar.setAttribute('aria-valuetext', seekbarInfo.textContent);
                if (typeof GalleryView !== 'undefined' && GalleryView.isActive) {
                    GalleryView.updateImagesAndReset([], 0);
                }
                if (typeof DualView !== 'undefined' && DualView.isActive) {
                    DualView.updateImagesAndReset([], 0, true);
                }
                showModeOverlay('画像が見つかりませんでした (folders.txtを確認してください)', '', 0);
                updateFilterBar(data);
                return;
            }

            allImagesUrls = data.images;
            // Calculate targetIndex first so we know where we start
            let targetIndex = 0;
            if (mode === 'dual' && typeof DualView !== 'undefined') {
                if (dualSortMode === 'asc') {
                    targetIndex = parseInt(localStorage.getItem(STORAGE_KEY_DUAL_INDEX)) || 0;
                    if (targetIndex >= allImagesUrls.length) targetIndex = 0;
                }
            } else if (typeof GalleryView !== 'undefined') {
                if (gallerySortMode === 'asc') {
                    targetIndex = parseInt(localStorage.getItem(STORAGE_KEY_GALLERY_INDEX)) || 0;
                    if (targetIndex >= allImagesUrls.length) targetIndex = 0;
                }
            }

            seekbar.max = Math.max(0, allImagesUrls.length - 1);
            updateSeekbar(); // Will update correctly based on updated getFolderBounds once mode enters. Wait, updateSeekbar relies on View state. We'll update it again afterward.
            updateFilterBar(data);

            const sortNames = {
                'asc': '昇順',
                'folder-random': 'フォルダ単位ランダム',
                'random': 'ランダム'
            };
            const sortName = sortNames[currentSort] || 'ランダム';
            const modeName = mode === 'dual' ? 'デュアルビューモード' : 'ギャラリーモード';
            const iconHtml = mode === 'dual'
                ? '<svg class="mode-icon" viewBox="0 0 24 24"><path d="M4 11h5V5H4v6zm0 7h5v-6H4v6zm6 0h5v-6h10v6zm0-7h5V5h-5v6zm6-6v6h5V5h-5z"/></svg>'
                : '<svg class="mode-icon" viewBox="0 0 24 24"><path d="M4 4h7v7H4zm9 0h7v7h-7zm-9 9h7v7H4zm9 0h7v7h-7z"/></svg>';

            let displayCount = allImagesUrls.length;
            if (currentSort === 'folder-random') {
                displayCount = getFolderBounds(targetIndex, allImagesUrls).total;
            }

            showModeOverlay(modeName, sortName, displayCount, iconHtml);

            // Startup based on mode
            if (mode === 'dual' && typeof DualView !== 'undefined') {
                DualView.enter(allImagesUrls, targetIndex, dualInterval, handleDualExit);
            } else if (typeof GalleryView !== 'undefined') {
                GalleryView.enter(allImagesUrls, targetIndex, { onEnd: handleGalleryEnd });
            }
            updateSeekbar();
            updateStopBtnIcon();
        } catch (error) {
            console.error('Error fetching images:', error);
            showModeOverlay('サーバーと通信できません', '', 0);
        } finally {
            if (reloadBtn) {
                reloadBtn.disabled = false;
                const svg = reloadBtn.querySelector('svg');
                if (svg) svg.classList.remove('spin');
            }
        }
    }

    function showModeOverlay(modeName, sortName, count, iconHtml) {
        if (!modeOverlay) return;

        const safeModeName = escapeHTML(modeName);
        const sortPart = sortName ? ` [${escapeHTML(sortName)}]` : '';
        const countPart = (typeof count === 'number' && count > 0) ? ` [${count}枚]` : '';
        currentModeMessage = `${iconHtml || ''} <span>${safeModeName}${sortPart}${countPart}</span>`;
        
        displayOverlayTemporarily();
    }

    function updateFilterBar(data) {
        if (!modeOverlay) return;
        
        if (!enableInclude || !data.filterInclude || data.filterInclude.length === 0) {
            currentFilterDisplay = '';
        } else {
            const modeText = data.filterMode === 'OR' ? 'OR条件' : 'AND条件';
            const keywords = data.filterInclude.map(k => escapeHTML(k)).join(', ');
            currentFilterDisplay = `<span><span class="filter-label">${escapeHTML(modeText)}:</span> ${keywords}</span>`;
        }
        
        displayOverlayTemporarily();
    }

    function displayOverlayTemporarily() {
        refreshOverlayContent();
        modeOverlay.classList.add('show');

        if (overlayHideTimer) clearTimeout(overlayHideTimer);
        overlayHideTimer = setTimeout(() => {
            modeOverlay.classList.remove('show');
            // After fade-out, reset internal message state
            setTimeout(() => {
                currentModeMessage = '';
            }, 400);
        }, 3000);
    }

    function refreshOverlayContent() {
        if (!modeOverlay) return;
        
        let html = '';
        if (currentModeMessage) {
            html += currentModeMessage;
        }
        
        if (currentFilterDisplay) {
            const separator = currentModeMessage ? 
                '<span style="opacity: 0.3; margin: 0 15px;">|</span>' : '';
            html += separator + currentFilterDisplay;
        }

        modeOverlay.innerHTML = html;
    }

    function showDirectionArrow(isRtl) {
        const overlay = document.getElementById('direction-overlay');
        if (!overlay) return;

        // 右から左(isRtl=true)なら左向きの矢印、左から右(isRtl=false)なら右向きの矢印を表示
        const arrowPath = isRtl
            ? '<path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>' // Left arrow
            : '<path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/>'; // Right arrow

        overlay.innerHTML = `<svg viewBox="0 0 24 24">${arrowPath}</svg>`;
        
        // アニメーションの再実行（クラスの付け替え）
        overlay.classList.remove('animate');
        void overlay.offsetWidth; // 強制リフロー
        overlay.classList.add('animate');
    }
 
    function toggleSeekbar() {
        if (!seekbarContainer) return;
        const isHidden = seekbarContainer.classList.contains('user-hidden');
        if (isHidden) {
            seekbarContainer.classList.remove('user-hidden');
            if (seekbarToggleIcon) seekbarToggleIcon.style.color = '#3498db';
            localStorage.setItem(STORAGE_KEY_SEEKBAR_VISIBLE, 'true');
            if (seekbarToggleBtn) {
                seekbarToggleBtn.title = 'シークバー非表示 (S)';
                seekbarToggleBtn.setAttribute('aria-label', seekbarToggleBtn.title);
            }
        } else {
            seekbarContainer.classList.add('user-hidden');
            if (seekbarToggleIcon) seekbarToggleIcon.style.color = '';
            localStorage.setItem(STORAGE_KEY_SEEKBAR_VISIBLE, 'false');
            if (seekbarToggleBtn) {
                seekbarToggleBtn.title = 'シークバー表示 (S)';
                seekbarToggleBtn.setAttribute('aria-label', seekbarToggleBtn.title);
            }
        }
    }

    function updateIncludeIcon() {
        if (!includeToggleIcon) return;
        if (enableInclude) {
            includeToggleIcon.style.color = '#3498db';
            if (includeToggleBtn) {
                includeToggleBtn.title = 'フィルター無効にする (F)';
                includeToggleBtn.setAttribute('aria-label', includeToggleBtn.title);
            }
        } else {
            includeToggleIcon.style.color = '';
            if (includeToggleBtn) {
                includeToggleBtn.title = 'フィルター有効にする (F)';
                includeToggleBtn.setAttribute('aria-label', includeToggleBtn.title);
            }
        }
    }

    function toggleInclude() {
        openFilterModal();
    }

    const SYSTEM_COMMENTS = [
        "# ここに記述された文字列がファイルパスに含まれる画像のみを表示します（1行に1つ）",
        "# デフォルトはすべての単語を含む画像を表示する「AND検索」です。",
        "# どれか一つでも含むものを表示する「OR検索」に切り替えたい場合は、ファイル内に MODE:OR と記述してください。",
        "# 例:"
    ];

    function openFilterModal() {
        if (!filterModal) return;
        
        filterGlobalEnable.checked = enableInclude;
        
        fetch('/api/include-file')
            .then(r => r.json())
            .then(res => {
                if (res.error) {
                    alert('設定ファイルの読み込みに失敗しました');
                    return;
                }
                const text = res.text || '';
                const lines = text.split(/\r?\n/);
                
                let mode = 'AND';
                let filters = [];
                
                for (let line of lines) {
                    let trimmed = line.trim();
                    if (!trimmed) continue;
                    if (SYSTEM_COMMENTS.includes(trimmed)) continue;
                    if (trimmed === 'MODE:OR' || trimmed === '# MODE:OR') { mode = 'OR'; continue; }
                    if (trimmed === 'MODE:AND' || trimmed === '# MODE:AND') { mode = 'AND'; continue; }
                    
                    let checked = true;
                    if (trimmed.startsWith('#')) {
                        checked = false;
                        trimmed = trimmed.replace(/^#\s*/, '');
                    }
                    if (trimmed) {
                        filters.push({ word: trimmed, checked });
                    }
                }
                
                Array.from(filterModeRadios).forEach(r => {
                    r.checked = (r.value === mode);
                });
                
                filterList.innerHTML = '';
                
                filters.sort((a, b) => {
                    if (a.checked && !b.checked) return -1;
                    if (!a.checked && b.checked) return 1;
                    return 0; // Maintain original order for equally checked/unchecked items
                });
                
                filters.forEach(f => {
                    addFilterCheckboxUI(f.word, f.checked);
                });
                
                filterNewWord.value = '';
                
                previousFocus = document.activeElement;
                filterModal.style.display = 'block';
                document.body.style.overflow = 'hidden';
            })
            .catch(console.error);
    }

    function addFilterCheckboxUI(word, checked) {
        const lbl = document.createElement('label');
        lbl.style.display = 'flex';
        lbl.style.alignItems = 'center';
        lbl.style.gap = '8px';
        lbl.style.padding = '8px 12px';
        lbl.style.background = 'rgba(255,255,255,0.05)';
        lbl.style.borderRadius = '6px';
        lbl.style.cursor = 'pointer';
        
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = word;
        cb.checked = checked;
        cb.className = 'filter-word-cb';
        cb.style.transform = 'scale(1.2)';
        
        const span = document.createElement('span');
        span.textContent = word;

        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.setAttribute('aria-label', `フィルター「${word}」を削除`);
        delBtn.textContent = '×';
        delBtn.style.marginLeft = 'auto';
        delBtn.style.color = '#e74c3c';
        delBtn.style.fontWeight = 'bold';
        delBtn.style.padding = '0 5px';
        delBtn.style.cursor = 'pointer';
        delBtn.style.background = 'transparent';
        delBtn.style.border = 'none';
        delBtn.onclick = (e) => {
            e.preventDefault();
            lbl.remove();
        };
        
        lbl.appendChild(cb);
        lbl.appendChild(span);
        lbl.appendChild(delBtn);
        filterList.appendChild(lbl);
    }

    function closeFilterModal() {
        if (!filterModal) return;
        filterModal.style.display = 'none';
        document.body.style.overflow = '';
        if (previousFocus) previousFocus.focus();
    }

    function saveFilterModal() {
        if (!filterModal) return;
        
        const newEnableInclude = filterGlobalEnable.checked;
        const enableIncludeChanged = (enableInclude !== newEnableInclude);
        enableInclude = newEnableInclude;
        localStorage.setItem(STORAGE_KEY_ENABLE_INCLUDE, enableInclude);
        
        let selectedMode = 'AND';
        Array.from(filterModeRadios).forEach(r => {
            if (r.checked) selectedMode = r.value;
        });
        
        let newText = SYSTEM_COMMENTS.join('\n') + '\n\n';
        newText += `MODE:${selectedMode}\n`;
        
        const cbs = filterList.querySelectorAll('.filter-word-cb');
        cbs.forEach(cb => {
            const word = cb.value;
            if (cb.checked) {
                newText += `${word}\n`;
            } else {
                newText += `# ${word}\n`;
            }
        });
        
        fetch('/api/include-file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: newText })
        }).then(r => r.json()).then(res => {
            if (res.success) {
                closeFilterModal();
                updateIncludeIcon();
                // サーバー側のファイル更新と再読込を少し待機してから画像を再取得
                setTimeout(() => {
                    // 現在の画像URLなどを保存しておく
                    const mode = localStorage.getItem(STORAGE_KEY_MODE) || 'gallery';
                    const currentSort = mode === 'dual' ? dualSortMode : gallerySortMode;
                    
                    let currentImgUrl = null;
                    if (mode === 'dual' && typeof DualView !== 'undefined' && DualView.isActive && allImagesUrls.length > 0) {
                        currentImgUrl = allImagesUrls[DualView.currentIndex];
                    } else if (mode === 'gallery' && typeof GalleryView !== 'undefined' && GalleryView.isActive && allImagesUrls.length > 0) {
                        currentImgUrl = allImagesUrls[GalleryView.currentIndex];
                    }
                    
                    fetch(`/api/images?sort=${currentSort}&enableInclude=${enableInclude}`)
                        .then(r => r.json())
                        .then(data => {
                            allImagesUrls = data.images || [];
                            const total = data.totalFound !== undefined ? data.totalFound : allImagesUrls.length;
                            
                            if (total === 0) {
                                seekbar.max = 0;
                                seekbar.value = 0;
                                seekbarInfo.textContent = '0 / 0';
                                seekbar.setAttribute('aria-valuetext', seekbarInfo.textContent);
                                if (typeof GalleryView !== 'undefined' && GalleryView.isActive) {
                                    GalleryView.updateImagesAndReset([], 0);
                                }
                                if (typeof DualView !== 'undefined' && DualView.isActive) {
                                    DualView.updateImagesAndReset([], 0, true);
                                }
                                const filterStatus = enableInclude ? '有効' : '無効';
                                showModeOverlay('画像が見つかりませんでした', `フィルター${filterStatus}`, 0);
                            } else {
                                seekbar.max = Math.max(0, allImagesUrls.length - 1);
                                
                                const iconHtml = '<svg class="mode-icon" viewBox="0 0 24 24"><path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z"/></svg>';
                                let displayCount = allImagesUrls.length;
                                
                                let targetIndex = 0;
                                if (currentImgUrl) {
                                    const newIdx = allImagesUrls.indexOf(currentImgUrl);
                                    if (newIdx >= 0) {
                                        targetIndex = newIdx;
                                    }
                                }
            
                                if (currentSort === 'folder-random') {
                                    displayCount = getFolderBounds(targetIndex, allImagesUrls).total;
                                }
            
                                showModeOverlay('フィルター適用', enableInclude ? '有効' : '無効', displayCount, iconHtml);
                                
                                if (mode === 'dual' && typeof DualView !== 'undefined' && DualView.isActive) {
                                    DualView.updateImagesAndReset(allImagesUrls, targetIndex, true);
                                } else if (mode === 'gallery' && typeof GalleryView !== 'undefined' && GalleryView.isActive) {
                                    GalleryView.updateImagesAndReset(allImagesUrls, targetIndex, { restoreSpeed: true });
                                } else {
                                    loadImages();
                                }
                            }
                            updateSeekbar();
                            updateFilterBar(data);
                        })
                        .catch(err => {
                            console.error('Error fetching filtered images:', err);
                            loadImages();
                        });
                }, 300);
            }
        }).catch(err => {
            console.error('Failed to save filter:', err);
            closeFilterModal();
            updateIncludeIcon();
            loadImages();
        });
    }

    function updateSeekbar() {
        if (!seekbar || allImagesUrls.length === 0 || isDraggingSeekbar) return;
        let currentIndex = 0;
        const mode = localStorage.getItem(STORAGE_KEY_MODE) || 'gallery';
        if (mode === 'dual' && typeof DualView !== 'undefined' && DualView.isActive) {
            currentIndex = DualView.currentIndex;
        } else if (typeof GalleryView !== 'undefined' && GalleryView.isActive) {
            currentIndex = GalleryView.currentIndex;
        }
        
        const currentSort = mode === 'dual' ? dualSortMode : gallerySortMode;
        if (currentSort === 'folder-random') {
            const bounds = getFolderBounds(currentIndex, allImagesUrls);
            seekbar.max = Math.max(0, bounds.total - 1);
            seekbar.value = bounds.relativeIndex;
            seekbarInfo.textContent = `${bounds.relativeIndex + 1} / ${bounds.total}`;
            seekbar.setAttribute('aria-valuetext', seekbarInfo.textContent);
        } else {
            seekbar.max = Math.max(0, allImagesUrls.length - 1);
            seekbar.value = currentIndex;
            seekbarInfo.textContent = `${currentIndex + 1} / ${allImagesUrls.length}`;
            seekbar.setAttribute('aria-valuetext', seekbarInfo.textContent);
        }
        updateStopBtnIcon();
    }

    function updateStopBtnIcon() {
        if (!stopBtn) return;
        const svg = stopBtn.querySelector('svg');
        if (!svg) return;

        const isStopped = (typeof DualView !== 'undefined' && DualView.isActive && (DualView.interval === 0 || DualView.isPaused)) ||
                         (typeof GalleryView !== 'undefined' && GalleryView.isActive && (GalleryView.scrollSpeed === 0 || GalleryView.isPaused));

        if (isStopped) {
            // Play Icon
            svg.innerHTML = '<path d="M8 5v14l11-7z" />';
            stopBtn.title = '再生開始 (Space)';
            stopBtn.setAttribute('aria-label', stopBtn.title);
        } else {
            // Stop Icon
            svg.innerHTML = '<path d="M6 6h12v12H6z" />';
            stopBtn.title = '停止 (Space)';
            stopBtn.setAttribute('aria-label', stopBtn.title);
        }
    }


    function toggleMode() {
        if (typeof DualView === 'undefined' || typeof GalleryView === 'undefined') return;

        if (GalleryView.isActive) {
            // 昇順モード（asc）なら位置復元、ランダムモード（random）ならギャラリーに同期
            const index = GalleryView.currentIndex;
            const currentImgUrl = allImagesUrls[index];
            if (gallerySortMode === 'asc') {
                localStorage.setItem(STORAGE_KEY_GALLERY_INDEX, index);
            }
            GalleryView.exit();

            localStorage.setItem(STORAGE_KEY_MODE, 'dual');
            updateSortIcon();
            updateModeIcon();

            const sortNames = {
                'asc': '昇順',
                'folder-random': 'フォルダ単位ランダム',
                'random': 'ランダム'
            };
            const iconHtml = '<svg class="mode-icon" viewBox="0 0 24 24"><path d="M4 11h5V5H4v6zm0 7h5v-6H4v6zm6 0h5v-6h10v6zm0-7h5V5h-5v6zm6-6v6h5V5h-5z"/></svg>';
            let displayCount = allImagesUrls.length;
            if (dualSortMode === 'folder-random') {
                displayCount = getFolderBounds(index, allImagesUrls).total;
            }
            showModeOverlay('デュアルビューモード', sortNames[dualSortMode] || 'ランダム', displayCount, iconHtml);

            if (gallerySortMode !== dualSortMode) {
                fetch(`/api/images?sort=${dualSortMode}&enableInclude=${enableInclude}`).then(r => r.json()).then(data => {
                    allImagesUrls = data.images;
                    
                    if (allImagesUrls.length === 0) {
                        seekbar.max = 0;
                        seekbar.value = 0;
                        seekbarInfo.textContent = '0 / 0';
                        seekbar.setAttribute('aria-valuetext', seekbarInfo.textContent);
                        DualView.enter([], 0, dualInterval, handleDualExit);
                        showModeOverlay('画像が見つかりませんでした', sortNames[dualSortMode] || 'ランダム', 0);
                        return;
                    }

                    // 昇順への復帰かつ以前の位置がある場合は復元を優先、そうでなければ同じ画像を探す
                    let targetIndex;
                    if (dualSortMode === 'asc' && lastDualIndex >= 0) {
                        targetIndex = lastDualIndex;
                    } else {
                        const newIdx = allImagesUrls.indexOf(currentImgUrl);
                        targetIndex = (newIdx >= 0) ? newIdx : 0;
                    }
                    DualView.enter(allImagesUrls, targetIndex, dualInterval, handleDualExit);
                    updateFilterBar(data);
                }).catch(console.error);
            } else {
                // ソートが同じ場合：昇順なら復元、ランダムなら現在のギャラリー位置を使用
                const targetIndex = (dualSortMode === 'asc' && lastDualIndex >= 0) ? lastDualIndex : index;
                DualView.enter(allImagesUrls, targetIndex, dualInterval, handleDualExit);
            }
            updateStopBtnIcon();
        } else if (DualView.isActive) {
            const index = DualView.currentIndex; // DualView needs an index getter
            DualView.exit();
        }
    }

    function handleDualExit(exitIndex) {
        if (isResetting) return;
        if (dualSortMode === 'asc') {
            lastDualIndex = exitIndex; // ソート（昇順）モード終了時の位置を保存
            localStorage.setItem(STORAGE_KEY_DUAL_INDEX, exitIndex);
        }
        localStorage.setItem(STORAGE_KEY_MODE, 'gallery');
        updateSortIcon();
        updateModeIcon();

        const sortNames = {
            'asc': '昇順',
            'folder-random': 'フォルダ単位ランダム',
            'random': 'ランダム'
        };
        const iconHtml = '<svg class="mode-icon" viewBox="0 0 24 24"><path d="M4 4h7v7H4zm9 0h7v7h-7zm-9 9h7v7H4zm9 0h7v7h-7z"/></svg>';
        let displayCount = allImagesUrls.length;
        if (gallerySortMode === 'folder-random') {
            displayCount = getFolderBounds(exitIndex, allImagesUrls).total;
        }
        showModeOverlay('ギャラリーモード', sortNames[gallerySortMode] || 'ランダム', displayCount, iconHtml);

        if (gallerySortMode !== dualSortMode) {
            loadImages();
        } else {
            GalleryView.enter(allImagesUrls, exitIndex, { onEnd: handleGalleryEnd });
        }
        updateStopBtnIcon();
    }

    function toggleSort() {
        const mode = localStorage.getItem(STORAGE_KEY_MODE) || 'gallery';
        let currentSort = mode === 'dual' ? dualSortMode : gallerySortMode;
        
        // asc -> folder-random -> random -> asc
        const nextSortMode = (current) => {
            if (current === 'asc') return 'folder-random';
            if (current === 'folder-random') return 'random';
            return 'asc';
        };

        let currentImgUrl = null;
        if (mode === 'dual' && typeof DualView !== 'undefined' && DualView.isActive && allImagesUrls.length > 0) {
            currentImgUrl = allImagesUrls[DualView.currentIndex];
            if (dualSortMode === 'asc') {
                lastDualIndex = DualView.currentIndex;
                localStorage.setItem(STORAGE_KEY_DUAL_INDEX, lastDualIndex);
            }
            dualSortMode = nextSortMode(dualSortMode);
            localStorage.setItem(STORAGE_KEY_DUAL_SORT, dualSortMode);
            currentSort = dualSortMode;
        } else if (mode === 'gallery' && typeof GalleryView !== 'undefined' && GalleryView.isActive && allImagesUrls.length > 0) {
            currentImgUrl = allImagesUrls[GalleryView.currentIndex];
            if (gallerySortMode === 'asc') {
                localStorage.setItem(STORAGE_KEY_GALLERY_INDEX, GalleryView.currentIndex);
            }
            gallerySortMode = nextSortMode(gallerySortMode);
            localStorage.setItem(STORAGE_KEY_GALLERY_SORT, gallerySortMode);
            currentSort = gallerySortMode;
        }

        updateSortIcon();

        fetch(`/api/images?sort=${currentSort}&enableInclude=${enableInclude}`)
            .then(r => r.json())
            .then(data => {
                allImagesUrls = data.images;

                const sortNames = {
                    'asc': '昇順',
                    'folder-random': 'フォルダ単位ランダム',
                    'random': 'ランダム'
                };
                const sortName = sortNames[currentSort] || 'ランダム';

                if (allImagesUrls.length === 0) {
                    seekbar.max = 0;
                    seekbar.value = 0;
                    seekbarInfo.textContent = '0 / 0';
                    seekbar.setAttribute('aria-valuetext', seekbarInfo.textContent);
                    if (mode === 'dual' && typeof DualView !== 'undefined' && DualView.isActive) {
                        DualView.updateImagesAndReset([], 0, true);
                    } else if (mode === 'gallery' && typeof GalleryView !== 'undefined' && GalleryView.isActive) {
                        GalleryView.updateImagesAndReset([], 0);
                    }
                    showModeOverlay('画像が見つかりませんでした', sortName, 0);
                    return;
                }

                let targetIndex = 0;
                if (currentImgUrl) {
                    const newIdx = allImagesUrls.indexOf(currentImgUrl);
                    if (currentSort === 'asc') {
                        // ランダムやフォルダランダムからソート表示（昇順）へ戻る場合は、以前の場所（lastDualIndex/GALLERY_INDEX）を優先する
                        if (mode === 'dual' && lastDualIndex >= 0) {
                            targetIndex = lastDualIndex;
                        } else if (mode === 'gallery') {
                            const savedGalleryIndex = parseInt(localStorage.getItem(STORAGE_KEY_GALLERY_INDEX)) || 0;
                            targetIndex = savedGalleryIndex;
                        } else if (newIdx >= 0) {
                            targetIndex = newIdx;
                        }
                    } else if (currentSort === 'folder-random') {
                        // フォルダ内ランダムへの遷移: 遷移元の画像があった「フォルダ」を維持するため、同じ画像のインデックスを探す
                        if (newIdx >= 0) {
                            targetIndex = newIdx;
                        } else {
                            // フォールバック: とりあえず0から
                            targetIndex = 0;
                        }
                    } else {
                        // ランダム表示へ移行する場合は、シャッフルされたリストの先頭から表示して画面を完全に再描画する
                        targetIndex = 0;
                    }
                }

                seekbar.max = Math.max(0, allImagesUrls.length - 1);

                let displayCount = allImagesUrls.length;
                if (currentSort === 'folder-random') {
                    displayCount = getFolderBounds(targetIndex, allImagesUrls).total;
                }

                if (mode === 'dual' && typeof DualView !== 'undefined' && DualView.isActive) {
                    DualView.updateImagesAndReset(allImagesUrls, targetIndex);
                    const iconHtml = '<svg class="mode-icon" viewBox="0 0 24 24"><path d="M4 11h5V5H4v6zm0 7h5v-6H4v6zm6 0h5v-6h10v6zm0-7h5V5h-5v6zm6-6v6h5V5h-5z"/></svg>';
                    showModeOverlay('デュアルビューモード', sortName, displayCount, iconHtml);
                } else if (mode === 'gallery' && typeof GalleryView !== 'undefined' && GalleryView.isActive) {
                    GalleryView.updateImagesAndReset(allImagesUrls, targetIndex, { restoreSpeed: true });
                    window.scrollTo(0, 0);
                    const iconHtml = '<svg class="mode-icon" viewBox="0 0 24 24"><path d="M4 4h7v7H4zm9 0h7v7h-7zm-9 9h7v7H4zm9 0h7v7h-7z"/></svg>';
                    showModeOverlay('ギャラリーモード', sortName, displayCount, iconHtml);
                }
                updateSeekbar();
                updateFilterBar(data);
            })
            .catch(err => {
                console.error('Error fetching sorted images:', err);
                loadImages();
            });
    }

    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().then(() => {
                if (navigator.keyboard && navigator.keyboard.lock) {
                    navigator.keyboard.lock(['Escape']).catch(console.error);
                }
            }).catch(console.error);
        } else {
            if (document.exitFullscreen) document.exitFullscreen();
        }
    }

    function toggleDirection() {
        if (!DualView.isActive && !GalleryView.isActive) return;

        const isRtl = localStorage.getItem(STORAGE_KEY_DUAL_RTL) !== 'false';
        const newState = !isRtl;
        localStorage.setItem(STORAGE_KEY_DUAL_RTL, newState);

        if (typeof DualView !== 'undefined') DualView.setDirection(newState);
        if (typeof GalleryView !== 'undefined') GalleryView.setDirection(newState);

        updateDirIcon();
        showDirectionArrow(newState);
        const dirText = newState ? '右から左へ' : '左から右へ';
        showModeOverlay('表示順変更', dirText, null, '<svg class="mode-icon" viewBox="0 0 24 24"><path d="M19 15l-3.5-3.5L14 13l2.5 2.5H5v2h11.5L14 20l1.5 1.5L19 18v-3zM5 9l3.5 3.5L10 11 7.5 8.5H19v-2H7.5L10 4 8.5 2.5 5 6v3z"/></svg>');
    }

    function toggleColorMode() {
        const colorModes = ['', 'color-mode-gray', 'color-mode-sepia', 'color-mode-invert', 'color-mode-contrast', 'color-mode-saturate', 'color-mode-blur', 'color-mode-pixel', 'color-mode-crt'];
        const colorModeNames = ['無加工', 'グレイ', 'セピア', 'ネガティブ', '高コントラスト', '高彩度', 'ぼかし', 'ドット絵', 'ブラウン管'];
        
        if (colorModes[currentColorModeIndex]) {
            document.body.classList.remove(colorModes[currentColorModeIndex]);
        }
        
        currentColorModeIndex = (currentColorModeIndex + 1) % colorModes.length;
        localStorage.setItem(STORAGE_KEY_COLOR_MODE, currentColorModeIndex);
        
        if (colorModes[currentColorModeIndex]) {
            document.body.classList.add(colorModes[currentColorModeIndex]);
        }
        
        const paletteIcon = '<svg class="mode-icon" viewBox="0 0 24 24"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1-.23-.27-.38-.62-.38-1 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>';
        showModeOverlay('色モード', colorModeNames[currentColorModeIndex], null, paletteIcon);

        if (colorModeBtn) {
            colorModeBtn.title = `色モード変更 (${colorModeNames[currentColorModeIndex]}) (C)`;
            colorModeBtn.setAttribute('aria-label', colorModeBtn.title);
        }
    }

    function toggleCursorTooltip() {
        enableCursorTooltip = !enableCursorTooltip;
        localStorage.setItem(STORAGE_KEY_CURSOR_TOOLTIP, enableCursorTooltip);
        if (cursorTooltipIcon) {
            cursorTooltipIcon.style.color = enableCursorTooltip ? '#3498db' : '';
        }
        if (!enableCursorTooltip && cursorTooltip) {
            cursorTooltip.style.opacity = '0';
        }
        const stateText = enableCursorTooltip ? '有効' : '無効';
        const iconHtml = '<svg class="mode-icon" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>';
        showModeOverlay('ファイル名表示', stateText, null, iconHtml);
        if (enableCursorTooltip) updateCursorTooltipContent();

        if (cursorTooltipBtn) {
            cursorTooltipBtn.title = enableCursorTooltip ? 'ファイル名表示を無効にする (I)' : 'ファイル名表示を有効にする (I)';
            cursorTooltipBtn.setAttribute('aria-label', cursorTooltipBtn.title);
        }
    }

    function updateCursorTooltipContent() {
        if (!enableCursorTooltip || !cursorTooltip) return;

        // マウスカーソルが非表示状態（操作がない時など）なら、ツールチップも隠す
        if (document.documentElement.classList.contains('hide-cursor')) {
            cursorTooltip.style.opacity = '0';
            return;
        }

        const target = document.elementFromPoint(lastMouseX, lastMouseY);
        if (target && target.tagName === 'IMG') {
            const filename = typeof getFilename === 'function' ? getFilename(target.src) : '';
            const foldername = typeof getFolderDisplayName === 'function' ? getFolderDisplayName(target.src) : '';
            if (filename) {
                cursorTooltip.textContent = foldername ? `${foldername} > ${filename}` : filename;
                
                // Position the tooltip at the current mouse position
                cursorTooltip.style.left = `${lastMouseX}px`;
                cursorTooltip.style.top = `${lastMouseY}px`;
                
                // Perform boundary checks for fixed tooltip layout
                const tipRect = cursorTooltip.getBoundingClientRect();
                let offsetX = 15;
                let offsetY = 15;
                
                if (lastMouseX + tipRect.width + 15 > window.innerWidth) {
                    offsetX = -(tipRect.width + 15);
                }
                if (lastMouseY + tipRect.height + 15 > window.innerHeight) {
                    offsetY = -(tipRect.height + 15);
                }
                
                cursorTooltip.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
                cursorTooltip.style.opacity = '1';
            } else {
                cursorTooltip.style.opacity = '0';
            }
        } else {
            cursorTooltip.style.opacity = '0';
        }
    }

    // --- Global Event Listeners ---

    reloadBtn.addEventListener('click', (e) => { e.stopPropagation(); loadImages(); });
    modeBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleMode(); });
    sortBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleSort(); });
    fullscreenBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleFullscreen(); });
    dirBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleDirection(); });
    seekbarToggleBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleSeekbar(); });
    if(includeToggleBtn) includeToggleBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleInclude(); });
    if(colorModeBtn) colorModeBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleColorMode(); });
    if(cursorTooltipBtn) cursorTooltipBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleCursorTooltip(); });

    if(fileSelectBtn) {
        fileSelectBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            fetch('/api/config-files')
                .then(r => r.json())
                .then(res => {
                    if (res.error) {
                        alert(res.error);
                        return;
                    }
                    fileListContainer.innerHTML = '';
                    res.files.forEach(file => {
                        const btn = document.createElement('button');
                        btn.type = 'button';
                        btn.className = 'file-item';
                        if (file === res.current) {
                            btn.classList.add('active');
                            btn.textContent = `${file} (選択中)`;
                        } else {
                            btn.textContent = file;
                        }
                        btn.addEventListener('click', () => {
                            fetch('/api/set-config-file', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ file: file })
                            }).then(r => r.json()).then(postRes => {
                                if (postRes.success) {
                                    fileSelectModal.style.display = 'none';
                                    document.body.style.overflow = ''; // Restore overflow
                                    if (previousFocus) {
                                        previousFocus.focus();
                                    }
                                    
                                    const mode = localStorage.getItem(STORAGE_KEY_MODE) || 'gallery';
                                    const currentSort = mode === 'dual' ? dualSortMode : gallerySortMode;
                                    
                                    fetch(`/api/images?sort=${currentSort}&enableInclude=${enableInclude}`)
                                        .then(r => r.json())
                                        .then(data => {
                                            allImagesUrls = data.images || [];
                                            
                                            if (allImagesUrls.length === 0) {
                                                seekbar.max = 0;
                                                seekbar.value = 0;
                                                seekbarInfo.textContent = '0 / 0';
                                                seekbar.setAttribute('aria-valuetext', seekbarInfo.textContent);
                                                
                                                if (mode === 'dual' && typeof DualView !== 'undefined' && DualView.isActive) {
                                                    DualView.updateImagesAndReset([], 0, true);
                                                } else if (mode === 'gallery' && typeof GalleryView !== 'undefined' && GalleryView.isActive) {
                                                    GalleryView.updateImagesAndReset([], 0);
                                                }
                                                showModeOverlay('画像が見つかりませんでした', `ファイル: ${file}`, 0);
                                                return;
                                            }

                                            seekbar.max = Math.max(0, allImagesUrls.length - 1);
                                            
                                            if (mode === 'dual' && typeof DualView !== 'undefined' && DualView.isActive) {
                                                DualView.updateImagesAndReset(allImagesUrls, 0, true);
                                            } else if (mode === 'gallery' && typeof GalleryView !== 'undefined' && GalleryView.isActive) {
                                                GalleryView.updateImagesAndReset(allImagesUrls, 0, { restoreSpeed: true });
                                                window.scrollTo(0, 0);
                                            } else {
                                                loadImages();
                                            }
                                            
                                            updateSeekbar();
                                            // ⚡ Optimization: Update filter bar after reloading images to reflect new server state
                                            updateFilterBar(data);
                                            
                                            let displayCount = allImagesUrls.length;
                                            if (currentSort === 'folder-random') {
                                                displayCount = getFolderBounds(0, allImagesUrls).total;
                                            }
                                            showModeOverlay('設定変更', `ファイル: ${file}`, displayCount);
                                        })
                                        .catch(err => {
                                            console.error('Error post-set fetch:', err);
                                            loadImages();
                                        });
                                }
                            });
                        });
                        fileListContainer.appendChild(btn);
                    });
                    previousFocus = document.activeElement;
                    fileSelectModal.style.display = 'block';
                    document.body.style.overflow = 'hidden'; // Block background scroll
                    const firstBtn = fileSelectModal.querySelector('button.file-item');
                    if (firstBtn) {
                        firstBtn.focus();
                    } else if (closeFileModal) {
                        closeFileModal.focus();
                    }
                })
                .catch(console.error);
        });
    }

    if(closeFileModal) {
        closeFileModal.addEventListener('click', () => {
            fileSelectModal.style.display = 'none';
            document.body.style.overflow = ''; // Restore overflow
            if (previousFocus) {
                previousFocus.focus();
            }
        });
    }

    if(filterAddBtn) {
        filterAddBtn.addEventListener('click', () => {
            let word = filterNewWord.value.trim();
            if(!word) return;
            addFilterCheckboxUI(word, true);
            filterNewWord.value = '';
        });
    }
    
    if(filterNewWord) {
        filterNewWord.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                filterAddBtn.click();
            }
        });
    }

    if(closeFilterModalBtn) {
        closeFilterModalBtn.addEventListener('click', closeFilterModal);
    }

    if(saveFilterModalBtn) {
        saveFilterModalBtn.addEventListener('click', saveFilterModal);
    }

    // ⚡ Bolt Optimization: Throttle expensive elementFromPoint queries on mousemove
    // High-frequency events (125-1000Hz) cause jank if they do synchronous hit testing.
    // requestAnimationFrame bounds the work to display refresh rate (e.g. 60Hz).
    let isTooltipUpdateScheduled = false;
    document.addEventListener('mousemove', (e) => {
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        if (!enableCursorTooltip || !cursorTooltip) return;

        if (!isTooltipUpdateScheduled) {
            isTooltipUpdateScheduled = true;
            requestAnimationFrame(() => {
                updateCursorTooltipContent();
                isTooltipUpdateScheduled = false;
            });
        }
    });

    seekbar.addEventListener('mousedown', () => { isDraggingSeekbar = true; });
    seekbar.addEventListener('touchstart', () => { isDraggingSeekbar = true; }, { passive: true });

    seekbar.addEventListener('input', () => {
        resetActivityTimer();
        isDraggingSeekbar = true;
        if (allImagesUrls.length === 0) return;
        const val = parseInt(seekbar.value);
        let absoluteIndex = val;
        let displayTotal = allImagesUrls.length;
        
        const mode = localStorage.getItem(STORAGE_KEY_MODE) || 'gallery';
        const currentSort = mode === 'dual' ? dualSortMode : gallerySortMode;
        if (currentSort === 'folder-random') {
            const currentIndex = mode === 'dual' ? DualView.currentIndex : GalleryView.currentIndex;
            const bounds = getFolderBounds(currentIndex, allImagesUrls);
            absoluteIndex = bounds.start + val;
            displayTotal = bounds.total;
        }

        seekbarInfo.textContent = `${val + 1} / ${displayTotal}`;
        seekbar.setAttribute('aria-valuetext', seekbarInfo.textContent);
        
        if (DualView.isActive) {
            DualView.updateImagesAndReset(allImagesUrls, absoluteIndex, true);
        }
    });

    seekbar.addEventListener('change', () => {
        resetActivityTimer(); // 操作後はタイマーリセット
        isDraggingSeekbar = false;
        if (allImagesUrls.length === 0) return;
        const val = parseInt(seekbar.value);
        let absoluteIndex = val;
        
        const mode = localStorage.getItem(STORAGE_KEY_MODE) || 'gallery';
        const currentSort = mode === 'dual' ? dualSortMode : gallerySortMode;
        if (currentSort === 'folder-random') {
            const currentIndex = mode === 'dual' ? DualView.currentIndex : GalleryView.currentIndex;
            const bounds = getFolderBounds(currentIndex, allImagesUrls);
            absoluteIndex = bounds.start + val;
        }
        
        if (GalleryView.isActive) {
            GalleryView.updateImagesAndReset(allImagesUrls, absoluteIndex, { restoreSpeed: true });
            window.scrollTo(0, 0);
        }
    });

    let seekbarTooltipAnimationFrame = null;
    let latestSeekbarMouseX = 0;
    seekbar.addEventListener('mousemove', (e) => {
        if (!seekbarTooltip || allImagesUrls.length === 0) return;
        
        latestSeekbarMouseX = e.clientX;
        
        if (!seekbarTooltipAnimationFrame) {
            seekbarTooltipAnimationFrame = requestAnimationFrame(() => {
                const rect = seekbar.getBoundingClientRect();
                const offsetX = latestSeekbarMouseX - rect.left;
                const width = rect.width;

                const pct = Math.max(0, Math.min(1, offsetX / width));
                
                const mode = localStorage.getItem(STORAGE_KEY_MODE) || 'gallery';
                const currentSort = mode === 'dual' ? dualSortMode : gallerySortMode;
                if (currentSort === 'folder-random') {
                    const currentIndex = mode === 'dual' ? DualView.currentIndex : GalleryView.currentIndex;
                    const bounds = getFolderBounds(currentIndex, allImagesUrls);
                    const index = Math.round(pct * (bounds.total - 1));
                    seekbarTooltip.textContent = `${index + 1} / ${bounds.total}`;
                } else {
                    const index = Math.round(pct * (allImagesUrls.length - 1));
                    seekbarTooltip.textContent = `${index + 1} / ${allImagesUrls.length}`;
                }

                // コンテナ内での相対座標で配置
                const containerRect = seekbarContainer.getBoundingClientRect();
                seekbarTooltip.style.left = `${latestSeekbarMouseX - containerRect.left}px`;
                seekbarTooltip.style.opacity = '1';
                seekbarTooltipAnimationFrame = null;
            });
        }
    });

    seekbar.addEventListener('mouseleave', () => {
        if (seekbarTooltipAnimationFrame) {
            cancelAnimationFrame(seekbarTooltipAnimationFrame);
            seekbarTooltipAnimationFrame = null;
        }
        if (seekbarTooltip) seekbarTooltip.style.opacity = '0';
    });

    scrollUpBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (GalleryView.isActive) {
            GalleryView.changeScrollSpeed(-1);
            if (GalleryView.scrollSpeed !== 0) lastActiveGallerySpeed = GalleryView.scrollSpeed;
        } else if (DualView.isActive) {
            changeDualInterval(-1);
        }
        updateStopBtnIcon();
    });
    scrollDownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (GalleryView.isActive) {
            GalleryView.changeScrollSpeed(1);
            if (GalleryView.scrollSpeed !== 0) lastActiveGallerySpeed = GalleryView.scrollSpeed;
        } else if (DualView.isActive) {
            changeDualInterval(1);
        }
        updateStopBtnIcon();
    });
    stopBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (DualView.isActive) {
            if (DualView.interval === 0 || DualView.isPaused) {
                if (DualView.interval === 0) {
                    dualInterval = lastActiveDualInterval;
                    localStorage.setItem(STORAGE_KEY_DUAL_INTERVAL, dualInterval);
                    DualView.setAutoAdvance(dualInterval);
                } else {
                    DualView.togglePause();
                }
            } else {
                localStorage.setItem(STORAGE_KEY_DUAL_INTERVAL, 0);
                DualView.stop();
            }
        } else if (GalleryView.isActive) {
            if (GalleryView.scrollSpeed === 0 || GalleryView.isPaused) {
                if (GalleryView.scrollSpeed === 0 && !GalleryView.isPaused) {
                    GalleryView.changeScrollSpeed(lastActiveGallerySpeed);
                } else {
                    GalleryView.togglePause();
                }
            } else {
                GalleryView.stop();
            }
        }
        updateStopBtnIcon();
    });
    colMinusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (GalleryView.isActive) GalleryView.changeColumnCount(-1);
    });
    colPlusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (GalleryView.isActive) GalleryView.changeColumnCount(1);
    });

    document.addEventListener('fullscreenchange', () => {
        if (document.fullscreenElement) {
            fullscreenIcon.innerHTML = '<path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>';
            fullscreenBtn.title = 'フルスクリーン解除 (Enter)';
            fullscreenBtn.setAttribute('aria-label', fullscreenBtn.title);
        } else {
            fullscreenIcon.innerHTML = '<path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>';
            fullscreenBtn.title = 'フルスクリーン切替 (Enter)';
            fullscreenBtn.setAttribute('aria-label', fullscreenBtn.title);
        }
    });

    document.addEventListener('keydown', (e) => {
        // --- Modal Interaction Handling ---
        const isFileModalOpen = fileSelectModal && fileSelectModal.style.display === 'block';
        const isFilterModalOpen = filterModal && filterModal.style.display === 'block';
        
        if (isFileModalOpen || isFilterModalOpen) {
            if (e.key === 'Escape') {
                e.preventDefault();
                if (isFileModalOpen) {
                    fileSelectModal.style.display = 'none';
                } else if (isFilterModalOpen) {
                    filterModal.style.display = 'none';
                }
                document.body.style.overflow = ''; // Restore overflow
                if (previousFocus) {
                    previousFocus.focus();
                }
                return;
            }
            // Block custom background interactions by exiting the listener,
            // which allows the browser to natively handle Tab, Space, Enter, etc. for modal controls.
            return;
        }

        if (e.key === 'm' || e.key === 'M') {
            toggleMode();
        } else if (e.key === 'r' || e.key === 'R') {
            toggleSort();
        } else if (e.key === 'o' || e.key === 'O') {
            toggleDirection();
        } else if (e.key === 's' || e.key === 'S') {
            toggleSeekbar();
        } else if (e.key === 'c' || e.key === 'C') {
            toggleColorMode();
        } else if (e.key === 'i' || e.key === 'I') {
            toggleCursorTooltip();
        } else if (e.key === 'f' || e.key === 'F') {
            toggleInclude();
        } else if (e.key === 'Enter') {
            toggleFullscreen();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (GalleryView.isActive) {
                GalleryView.changeScrollSpeed(-1);
                if (GalleryView.scrollSpeed !== 0) lastActiveGallerySpeed = GalleryView.scrollSpeed;
            } else if (DualView.isActive) {
                DualView.prev(undefined, true);
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (GalleryView.isActive) {
                GalleryView.changeScrollSpeed(1);
                if (GalleryView.scrollSpeed !== 0) lastActiveGallerySpeed = GalleryView.scrollSpeed;
            } else if (DualView.isActive) {
                DualView.next(undefined, true);
            }
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            const isRtl = localStorage.getItem(STORAGE_KEY_DUAL_RTL) !== 'false';
            if (DualView.isActive) {
                isRtl ? DualView.next(1, true) : DualView.prev(1, true);
            } else if (GalleryView.isActive) {
                GalleryView.changeColumnCount(-1);
            }
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            const isRtl = localStorage.getItem(STORAGE_KEY_DUAL_RTL) !== 'false';
            if (DualView.isActive) {
                isRtl ? DualView.prev(1, true) : DualView.next(1, true);
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
                if (GalleryView.scrollSpeed === 0 && !GalleryView.isPaused) {
                    GalleryView.changeScrollSpeed(lastActiveGallerySpeed);
                } else {
                    GalleryView.togglePause();
                }
            }
            updateStopBtnIcon();
        } else if (e.key === 'Home') {
            if (DualView.isActive) {
                e.preventDefault();
                DualView.goToFirst(true);
            }
        } else if (e.key === 'End') {
            if (DualView.isActive) {
                e.preventDefault();
                DualView.goToLast(true);
            }
        } else if (e.key === '0') {
            resetAllSettings();
        } else if (e.key === 'PageUp') {
            e.preventDefault();
            skipFolder(-1);
        } else if (e.key === 'PageDown') {
            e.preventDefault();
            skipFolder(1);
        }
    });


    function skipFolder(direction) {
        const mode = localStorage.getItem(STORAGE_KEY_MODE) || 'gallery';
        const currentSort = mode === 'dual' ? dualSortMode : gallerySortMode;

        if (currentSort !== 'asc' && currentSort !== 'folder-random') {
            showModeOverlay('フォルダスキップは昇順またはフォルダ単位ランダム時のみ有効です', '', 0);
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
            DualView.updateImagesAndReset(allImagesUrls, targetIndex, true);
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
        localStorage.setItem(STORAGE_KEY_DUAL_SPEED, lastActiveDualInterval);
        localStorage.setItem(STORAGE_KEY_DUAL_INTERVAL, dualInterval);
        DualView.setAutoAdvance(dualInterval);
        updateStopBtnIcon();
    }

    function resetAllSettings() {
        // Stop current playback and ensure views are fully exited
        isResetting = true;
        if (typeof GalleryView !== 'undefined' && GalleryView.isActive) GalleryView.exit();
        if (typeof DualView !== 'undefined' && DualView.isActive) DualView.exit();
        isResetting = false;

        // Clear LocalStorage
        const keysToRemove = [
            STORAGE_KEY_MODE,
            STORAGE_KEY_GALLERY_SORT,
            STORAGE_KEY_DUAL_SORT,
            STORAGE_KEY_DUAL_INTERVAL,
            STORAGE_KEY_DUAL_RTL,
            STORAGE_KEY_DUAL_INDEX,
            STORAGE_KEY_DUAL_SPEED,
            STORAGE_KEY_GALLERY_INDEX,
            STORAGE_KEY_SEEKBAR_VISIBLE,
            STORAGE_KEY_ENABLE_INCLUDE,
            STORAGE_KEY_COLOR_MODE,
            STORAGE_KEY_CURSOR_TOOLTIP,
            'imageflow_scroll_speed',
            'imageflow_column_count'
        ];
        keysToRemove.forEach(key => localStorage.removeItem(key));

        // Reset internal variables
        enableInclude = false;
        enableCursorTooltip = false;
        lastDualIndex = -1;
        gallerySortMode = 'random';
        dualSortMode = 'asc';
        dualInterval = 0;
        lastActiveDualInterval = 10;
        lastActiveGallerySpeed = 2.0;
        currentColorModeIndex = 0;

        // Reset UI Components
        // 1. Color Mode
        const colorModes = ['', 'color-mode-gray', 'color-mode-sepia', 'color-mode-invert', 'color-mode-contrast', 'color-mode-saturate', 'color-mode-blur', 'color-mode-pixel', 'color-mode-crt'];
        colorModes.forEach(cls => { if (cls) document.body.classList.remove(cls); });

        // 2. Cursor Tooltip
        if (cursorTooltipIcon) cursorTooltipIcon.style.color = '';
        if (cursorTooltip) cursorTooltip.style.opacity = '0';

        // 3. Seekbar Visibility
        if (seekbarContainer) seekbarContainer.classList.add('user-hidden');
        if (seekbarToggleIcon) seekbarToggleIcon.style.color = '';
        if (seekbarToggleBtn) {
            seekbarToggleBtn.title = 'シークバー表示 (S)';
            seekbarToggleBtn.setAttribute('aria-label', seekbarToggleBtn.title);
        }

        // 4. Icons & Titles
        updateSortIcon();
        updateModeIcon();
        updateDirIcon();
        updateIncludeIcon();

        // 5. Views Re-Sync
        if (typeof DualView !== 'undefined') {
            DualView.setDirection(true);
            DualView.setAutoAdvance(0);
        }
        if (typeof GalleryView !== 'undefined') {
            GalleryView.setDirection(true);
            GalleryView.init(); // Re-read column count from storage (now reset to null/default 2)
        }

        // Show feedback
        const resetIcon = '<svg class="mode-icon" viewBox="0 0 24 24"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>';
        showModeOverlay('全設定を初期化しました', '', 0, resetIcon);

        // Reload everything
        loadImages();
    }

    // --- UI Auto-Hide ---
    const fabContainer = document.getElementById('fab-container');
    let activityTimeout = null;
    let lastActivityReset = 0;
    function resetActivityTimer() {
        // ⚡ Bolt Optimization: Throttle the UI hide timer reset to prevent thousands of clearTimeout/setTimeout calls on continuous mousemove
        const now = Date.now();
        if (now - lastActivityReset < 250) return;
        lastActivityReset = now;

        fabContainer.classList.remove('hidden');
        document.documentElement.classList.remove('hide-cursor');
        if (activityTimeout) clearTimeout(activityTimeout);
        activityTimeout = setTimeout(() => {
            fabContainer.classList.add('hidden');
            document.documentElement.classList.add('hide-cursor');
            lastActivityReset = 0;
        }, 3000);
    }
    ['mousemove', 'mousedown', 'touchstart', 'wheel'].forEach(type => {
        window.addEventListener(type, resetActivityTimer, { passive: true });
    });
    window.addEventListener('keydown', (e) => {
        // デュアルビューモード中でナビゲーションキー（カーソル、Home/End, PageUp/Down）操作の場合は、
        // 没入感を維持するためFABなどのUIを表示しない。
        const isNavKey = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key);
        if (typeof DualView !== 'undefined' && DualView.isActive && isNavKey) {
            return;
        }
        resetActivityTimer();
    }, { passive: true });
    resetActivityTimer();

    window.addEventListener('mousedown', (e) => {
        if (e.button === 1) {
            e.preventDefault();
            toggleFullscreen();
        }
    });
});
