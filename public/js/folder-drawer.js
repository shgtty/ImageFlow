/**
 * ImageFlow Folder Drawer Module
 * 画面左端からスライドインするフォルダ・ZIP内フォルダ一覧（先頭画像サムネイル付き）ドロワー
 */
const FolderDrawer = (() => {
    // DOM Elements
    let drawerEl = null;
    let listEl = null;
    let triggerEl = null;
    let searchInputEl = null;
    let clearSearchBtn = null;
    let pinBtn = null;
    let closeBtn = null;
    let folderCountBadge = null;

    // State
    let isOpen = false;
    let isPinned = false;
    let isMouseOverDrawer = false;
    let closeTimer = null;
    let allImages = [];
    let folders = []; // Array of folder objects
    let activeFolderPath = null;
    let onJumpCallback = null;

    const STORAGE_KEY_PINNED = 'imageflow_drawer_pinned';

    /**
     * フォルダデータの集計・抽出
     * @param {Array<string>} imageUrls 
     * @returns {Array<Object>}
     */
    function extractFolders(imageUrls) {
        if (!imageUrls || imageUrls.length === 0) return [];

        const folderMap = new Map();

        for (let i = 0; i < imageUrls.length; i++) {
            const url = imageUrls[i];
            const folderPath = (typeof getFolderPath === 'function') ? getFolderPath(url) : '';
            if (!folderPath) continue;

            let folderObj = folderMap.get(folderPath);
            if (!folderObj) {
                const isZip = folderPath.includes('|') || folderPath.toLowerCase().endsWith('.zip');
                let displayName = '';
                let subTitle = '';

                if (folderPath.includes('|')) {
                    const [zipPath, innerFolder] = folderPath.split('|');
                    const zipName = zipPath.split(/[/\\]/).pop();
                    if (innerFolder) {
                        displayName = `${zipName} / ${innerFolder}`;
                        subTitle = zipPath;
                    } else {
                        displayName = zipName;
                        subTitle = zipPath;
                    }
                } else {
                    const parts = folderPath.split(/[/\\]/);
                    displayName = parts[parts.length - 1] || folderPath;
                    subTitle = parts.slice(0, -1).join('/');
                }

                folderObj = {
                    folderPath,
                    displayName,
                    subTitle,
                    isZip,
                    firstImageUrl: url,
                    firstIndex: i,
                    count: 0
                };
                folderMap.set(folderPath, folderObj);
            }

            folderObj.count++;
        }

        return Array.from(folderMap.values());
    }

    /**
     * 初期化
     * @param {Object} options
     * @param {Function} options.onJump - (url, index) => void
     */
    function init(options = {}) {
        onJumpCallback = options.onJump;

        drawerEl = document.getElementById('folder-drawer');
        listEl = document.getElementById('folder-drawer-list');
        triggerEl = document.getElementById('drawer-hover-trigger');
        searchInputEl = document.getElementById('drawer-search-input');
        clearSearchBtn = document.getElementById('drawer-search-clear');
        pinBtn = document.getElementById('drawer-pin-btn');
        closeBtn = document.getElementById('drawer-close-btn');
        folderCountBadge = document.getElementById('drawer-folder-count');

        if (!drawerEl || !listEl) return;

        // Pin 状態の復元
        isPinned = localStorage.getItem(STORAGE_KEY_PINNED) === 'true';
        updatePinState();

        // 画面左端ホバー検知
        document.addEventListener('mousemove', handleDocumentMouseMove);

        // ドロワー上でのクリック、ダブルクリック、マウスボタン、ホイール等のイベントが背後へ漏れるのを防止
        ['click', 'dblclick', 'mousedown', 'mouseup', 'wheel'].forEach(evtType => {
            drawerEl.addEventListener(evtType, (e) => {
                e.stopPropagation();
            });
        });

        if (triggerEl) {
            ['click', 'dblclick', 'mousedown', 'mouseup', 'wheel'].forEach(evtType => {
                triggerEl.addEventListener(evtType, (e) => {
                    e.stopPropagation();
                });
            });
            triggerEl.addEventListener('mouseenter', () => {
                open();
            });
        }

        // ドロワー内のマウスイベント（離れたときに閉じる）
        drawerEl.addEventListener('mouseenter', () => {
            isMouseOverDrawer = true;
            if (closeTimer) {
                clearTimeout(closeTimer);
                closeTimer = null;
            }
        });

        drawerEl.addEventListener('mouseleave', () => {
            isMouseOverDrawer = false;
            // ドロワー内（検索欄など）にフォーカスがある間は閉じない
            if (!isPinned && isOpen && !drawerEl.contains(document.activeElement)) {
                scheduleClose();
            }
        });

        // 閉じるボタン
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                close(true);
            });
        }

        // ピン留めボタン
        if (pinBtn) {
            pinBtn.addEventListener('click', () => {
                isPinned = !isPinned;
                localStorage.setItem(STORAGE_KEY_PINNED, isPinned ? 'true' : 'false');
                updatePinState();
            });
        }

        // 検索フィルター
        if (searchInputEl) {
            searchInputEl.addEventListener('focus', () => {
                // 入力欄にフォーカスがある間は自動クローズを完全停止
                if (closeTimer) {
                    clearTimeout(closeTimer);
                    closeTimer = null;
                }
            });

            searchInputEl.addEventListener('blur', () => {
                // 入力欄からフォーカスが外れた時、マウスもドロワーの外にあれば閉じる
                if (!isPinned && isOpen && !isMouseOverDrawer) {
                    scheduleClose(300);
                }
            });

            searchInputEl.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    e.stopPropagation();
                    if (searchInputEl.value) {
                        searchInputEl.value = '';
                        if (clearSearchBtn) clearSearchBtn.style.display = 'none';
                        renderList('');
                    } else {
                        close(true);
                        searchInputEl.blur();
                    }
                    return;
                }
                // すべてのキーボードイベントがグローバルショートカットに漏れないよう遮断
                e.stopPropagation();
            });
            ['keyup', 'keypress'].forEach(evtType => {
                searchInputEl.addEventListener(evtType, (e) => {
                    e.stopPropagation();
                });
            });

            searchInputEl.addEventListener('input', () => {
                if (closeTimer) {
                    clearTimeout(closeTimer);
                    closeTimer = null;
                }
                const query = searchInputEl.value.trim().toLowerCase();
                if (clearSearchBtn) {
                    clearSearchBtn.style.display = query ? 'block' : 'none';
                }
                renderList(query);
            });
        }

        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', () => {
                if (searchInputEl) {
                    searchInputEl.value = '';
                    searchInputEl.focus();
                }
                clearSearchBtn.style.display = 'none';
                renderList('');
            });
        }
    }

    function handleDocumentMouseMove(e) {
        // マウスが画面左端 20px 以内に入ったらドロワーを開く
        if (e.clientX <= 20) {
            open();
        }
    }

    function updatePinState() {
        if (!drawerEl || !pinBtn) return;
        if (isPinned) {
            drawerEl.classList.add('pinned');
            pinBtn.classList.add('active');
            pinBtn.title = 'ピン留め解除（マウスを離すと閉じる）';
            pinBtn.setAttribute('aria-pressed', 'true');
        } else {
            drawerEl.classList.remove('pinned');
            pinBtn.classList.remove('active');
            pinBtn.title = 'ピン留め（常に表示）';
            pinBtn.setAttribute('aria-pressed', 'false');
        }
    }

    function open() {
        if (!drawerEl) return;
        if (closeTimer) {
            clearTimeout(closeTimer);
            closeTimer = null;
        }
        if (!isOpen) {
            isOpen = true;
            drawerEl.classList.add('open');
            // アクティブなフォルダが見える位置にスクロール
            scrollToActiveFolder();
        }
    }

    function close(force = false) {
        if (!drawerEl) return;
        // 強制でない場合、ドロワー内（検索欄など）にフォーカスがある時は閉じない
        if (!force && drawerEl.contains(document.activeElement)) {
            return;
        }
        if (closeTimer) {
            clearTimeout(closeTimer);
            closeTimer = null;
        }
        isOpen = false;
        drawerEl.classList.remove('open');
    }

    function scheduleClose(delayMs = 400) {
        if (closeTimer) clearTimeout(closeTimer);
        closeTimer = setTimeout(() => {
            if (!drawerEl) return;
            // ドロワー内にフォーカスがある場合は閉じない
            if (drawerEl.contains(document.activeElement)) {
                return;
            }
            // マウスがドロワー上にある場合は閉じない
            if (isMouseOverDrawer) {
                return;
            }
            close();
        }, delayMs);
    }

    function toggle() {
        if (isOpen) {
            close();
        } else {
            open();
        }
    }

    /**
     * 画像リストの更新
     * @param {Array<string>} imageUrls 
     */
    function setImages(imageUrls) {
        allImages = imageUrls || [];
        folders = extractFolders(allImages);

        if (folderCountBadge) {
            folderCountBadge.textContent = `${folders.length} フォルダ`;
        }

        const query = searchInputEl ? searchInputEl.value.trim().toLowerCase() : '';
        renderList(query);
    }

    /**
     * 現在アクティブな画像URLまたはフォルダパスの更新
     * @param {string} currentUrl 
     */
    function setActiveImage(currentUrl) {
        if (!currentUrl) return;
        const folderPath = (typeof getFolderPath === 'function') ? getFolderPath(currentUrl) : '';
        if (folderPath === activeFolderPath) return;

        activeFolderPath = folderPath;
        updateActiveHighlight();
    }

    function updateActiveHighlight() {
        if (!listEl) return;
        const items = listEl.querySelectorAll('.folder-drawer-item');
        items.forEach(item => {
            if (item.dataset.folderPath === activeFolderPath) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    function scrollToActiveFolder() {
        if (!listEl || !activeFolderPath) return;
        const activeItem = listEl.querySelector(`.folder-drawer-item[data-folder-path="${CSS.escape(activeFolderPath)}"]`);
        if (activeItem) {
            activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }

    /**
     * フォルダ一覧のレンダリング
     * @param {string} query 
     */
    function renderList(query = '') {
        if (!listEl) return;
        listEl.innerHTML = '';

        const filtered = query 
            ? folders.filter(f => f.displayName.toLowerCase().includes(query) || f.folderPath.toLowerCase().includes(query))
            : folders;

        if (filtered.length === 0) {
            const emptyEl = document.createElement('div');
            emptyEl.className = 'folder-drawer-empty';
            emptyEl.textContent = query ? '一致するフォルダがありません' : 'フォルダがありません';
            listEl.appendChild(emptyEl);
            return;
        }

        const fragment = document.createDocumentFragment();

        filtered.forEach(folder => {
            const item = document.createElement('div');
            item.className = 'folder-drawer-item';
            if (folder.folderPath === activeFolderPath) {
                item.classList.add('active');
            }
            item.dataset.folderPath = folder.folderPath;
            item.setAttribute('role', 'button');
            item.setAttribute('tabindex', '0');
            item.title = `${folder.displayName} (${folder.count}枚)\n${folder.folderPath}`;

            // サムネイルコンテナ
            const thumbBox = document.createElement('div');
            thumbBox.className = 'folder-drawer-thumb-box';

            const isVideo = (typeof isVideoUrl === 'function') ? isVideoUrl(folder.firstImageUrl) : false;

            // サムネイルメディア
            const mediaEl = document.createElement(isVideo ? 'video' : 'img');
            mediaEl.src = folder.firstImageUrl;
            mediaEl.loading = 'lazy';
            mediaEl.className = 'folder-drawer-thumb';

            if (isVideo) {
                mediaEl.muted = true;
                mediaEl.preload = 'metadata';
                mediaEl.playsInline = true;

                const videoBadge = document.createElement('div');
                videoBadge.className = 'folder-drawer-video-badge';
                videoBadge.innerHTML = '<svg viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>';
                thumbBox.appendChild(videoBadge);
            }

            // フォールバック用フォルダアイコン
            const fallbackIcon = document.createElement('div');
            fallbackIcon.className = 'folder-drawer-thumb-fallback';
            fallbackIcon.innerHTML = folder.isZip 
                ? '<svg viewBox="0 0 24 24"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6 10h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V6h2v2z"/></svg>'
                : '<svg viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>';
            thumbBox.appendChild(fallbackIcon);

            const handleMediaLoaded = () => {
                mediaEl.style.opacity = '1';
                fallbackIcon.style.display = 'none';
            };

            if (isVideo) {
                mediaEl.addEventListener('loadeddata', handleMediaLoaded);
            } else {
                mediaEl.onload = handleMediaLoaded;
            }

            mediaEl.onerror = () => {
                mediaEl.style.display = 'none';
                fallbackIcon.style.display = 'flex';
            };

            thumbBox.appendChild(mediaEl);

            // 情報コンテナ
            const infoBox = document.createElement('div');
            infoBox.className = 'folder-drawer-info';

            // フォルダ名
            const titleRow = document.createElement('div');
            titleRow.className = 'folder-drawer-title';
            titleRow.textContent = folder.displayName;
            infoBox.appendChild(titleRow);

            // メタデータ行（バッジ + 枚数）
            const metaRow = document.createElement('div');
            metaRow.className = 'folder-drawer-meta';

            if (folder.isZip) {
                const zipBadge = document.createElement('span');
                zipBadge.className = 'folder-drawer-badge badge-zip';
                zipBadge.textContent = 'ZIP';
                metaRow.appendChild(zipBadge);
            }

            const countSpan = document.createElement('span');
            countSpan.className = 'folder-drawer-count';
            countSpan.textContent = `${folder.count} 枚`;
            metaRow.appendChild(countSpan);

            infoBox.appendChild(metaRow);

            item.appendChild(thumbBox);
            item.appendChild(infoBox);

            // クリック時・キーボード操作時のジャンプ処理
            const handleClick = (e) => {
                e.stopPropagation();
                activeFolderPath = folder.folderPath;
                updateActiveHighlight();

                if (typeof onJumpCallback === 'function') {
                    onJumpCallback(folder.firstImageUrl, folder.firstIndex, folder);
                }

                // ピン留めされていない場合は閉じる
                if (!isPinned) {
                    close(true);
                }
            };

            item.addEventListener('click', handleClick);
            item.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleClick(e);
                }
            });

            fragment.appendChild(item);
        });

        listEl.appendChild(fragment);
    }

    return {
        init,
        setImages,
        setActiveImage,
        open,
        close,
        toggle,
        extractFolders,
        get isOpen() { return isOpen; },
        get isPinned() { return isPinned; },
        get folders() { return folders; }
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = FolderDrawer;
}
