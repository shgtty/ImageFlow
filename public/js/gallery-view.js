/**
 * Gallery View Mode for ImageFlow
 * Displays images in a multi-column masonry-style layout.
 */
const GalleryView = (() => {
    let isActive = false;
    let galleryElement = null;
    let speedIndicatorElement = null;

    let allImagesUrls = [];
    let currentIndex = 0;
    let currentStartIndex = 0;
    const BATCH_SIZE = 15;
    let columns = [];
    let columnHeights = [];
    let columnCount = 3;
    let pendingImages = 0;

    let scrollSpeed = 0;
    let isScrolling = false;
    let isPaused = false;
    let savedSpeedForPause = 0;
    let indicatorTimeout = null;
    let isRightToLeft = false;
    let currentRenderId = 0;
    let endDelayStartTime = 0;

    // Storage keys
    const STORAGE_KEY_SPEED = 'imageflow_scroll_speed';
    const STORAGE_KEY_COLUMNS = 'imageflow_column_count';

    function init() {
        galleryElement = document.getElementById('gallery');
        speedIndicatorElement = document.getElementById('speed-indicator');

        // Initial values from localStorage
        columnCount = parseInt(localStorage.getItem(STORAGE_KEY_COLUMNS)) || 2;
        if (columnCount < 1) columnCount = 1;
        if (columnCount > 10) columnCount = 10;

        scrollSpeed = parseFloat(localStorage.getItem(STORAGE_KEY_SPEED)) || 0;
    }

    let currentOptions = {};

    function enter(imageUrls, startIndex = 0, options = {}) {
        if (isActive) {
            updateImagesAndReset(imageUrls, startIndex, options);
            return;
        }
        isActive = true;

        allImagesUrls = imageUrls;
        currentIndex = startIndex;
        currentStartIndex = startIndex;
        pendingImages = 0;
        currentOptions = options;

        // Restore speed if needed
        if (options.restoreSpeed !== false) {
            scrollSpeed = parseFloat(localStorage.getItem(STORAGE_KEY_SPEED)) || 0;
        }

        renderInitial();

        if (scrollSpeed !== 0) {
            startAutoScroll();
        }

        window.addEventListener('scroll', handleManualScroll, { passive: true });
    }

    function updateImagesAndReset(imageUrls, startIndex = 0, options = {}) {
        allImagesUrls = imageUrls;
        currentIndex = startIndex;
        currentStartIndex = startIndex;
        pendingImages = 0;
        if (options) currentOptions = Object.assign(currentOptions, options);

        renderInitial();
        if (scrollSpeed !== 0) {
            startAutoScroll();
        }
    }

    function exit() {
        if (!isActive) return;
        isActive = false;

        stopAutoScroll();
        window.removeEventListener('scroll', handleManualScroll);

        // Clear gallery
        galleryElement.innerHTML = '';
        columns = [];
    }

    function renderInitial() {
        currentRenderId++;
        galleryElement.innerHTML = '';
        galleryElement.classList.add('loading'); // 初期構築中の「上寄せ」や「ガタつき」を見せない
        columns = [];

        // Initialize columns
        for (let i = 0; i < columnCount; i++) {
            const col = document.createElement('div');
            col.className = 'gallery-col';
            columns.push(col);
            galleryElement.appendChild(col);
        }
        columnHeights = new Array(columnCount).fill(0);

        // Render first batch
        renderNextBatch(30);

        // 構造ができあがってからフェードインさせる
        setTimeout(() => {
            galleryElement.classList.remove('loading');
        }, 200);
    }

    function renderNextBatch(count = BATCH_SIZE) {
        if (allImagesUrls.length === 0) return;
        if (currentIndex >= allImagesUrls.length) {
            // Should normally not happen if we loop but just a safety check
            currentIndex = 0;
        }

        const myRenderId = currentRenderId;
        const mode = localStorage.getItem('imageflow_display_mode') || 'gallery';
        const currentSort = mode === 'dual' ? localStorage.getItem('imageflow_dual_sort') : localStorage.getItem('imageflow_gallery_sort');
        const folderRandom = currentSort === 'folder-random';

        const batchImages = [];
        let tempIndex = currentIndex;

        for (let i = 0; i < count; i++) {
            if (tempIndex >= allImagesUrls.length) {
                if (folderRandom && typeof getFolderBounds === 'function') {
                    // Reached the end of the array, but since it's folder-random, it might mean the end of the folder is the end of the array. Wrap around!
                    const bounds = getFolderBounds(tempIndex - 1, allImagesUrls);
                    tempIndex = bounds.start;
                } else {
                    break; // Normal mode -> end
                }
            } else if (folderRandom && typeof getFolderBounds === 'function') {
               const bounds = getFolderBounds(currentIndex, allImagesUrls);
               if (tempIndex < bounds.start || tempIndex > bounds.end) {
                   // Hit folder boundary
                   tempIndex = bounds.start;
               }
            }

            const activeIndex = tempIndex;

            const wrapper = document.createElement('div');
            wrapper.className = 'image-wrapper';
            wrapper.dataset.index = activeIndex;

            const img = document.createElement('img');
            img.dataset.index = activeIndex;
            wrapper.appendChild(img);

            if (typeof window.createBookmarkButton === 'function') {
                const btn = window.createBookmarkButton(allImagesUrls[activeIndex]);
                wrapper.appendChild(btn);
            }

            const obj = { wrapper, img, loaded: false, error: false };
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

            img.src = allImagesUrls[activeIndex];
            img.alt = typeof getFilename === 'function' ? getFilename(allImagesUrls[activeIndex]) : 'Image ' + (activeIndex + 1);
            
            tempIndex++;
        }

        const totalInBatch = batchImages.length;
        if (totalInBatch === 0) return;
        
        pendingImages += totalInBatch;

        // バッチ内で順序通りにDOMへ追加していくためのポインタ
        let nextToPlace = 0;

        function processBatchQueue() {
            if (myRenderId !== currentRenderId) return;
            
            // ⚡ Bolt Optimization: Calculate column width outside the loop to avoid Layout Thrashing
            // Using galleryElement width if available, fallback to window.innerWidth
            const baseWidth = galleryElement ? galleryElement.offsetWidth : window.innerWidth;
            const colWidth = (columns[0] && columns[0].offsetWidth) || (baseWidth / columnCount);

            while (nextToPlace < totalInBatch && batchImages[nextToPlace].loaded) {
                const currentObj = batchImages[nextToPlace];
                if (!currentObj.error) {
                    const wrapper = currentObj.wrapper;
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
                    shortestCol.appendChild(wrapper);

                    const ratio = img.naturalHeight / img.naturalWidth;
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

        currentIndex = tempIndex;
    }

    let isManualScrollPending = false;

    function handleManualScroll() {
        if (!isActive) return;

        // ⚡ Bolt Optimization: Throttle expensive layout queries (scrollHeight, innerHeight, scrollY) on scroll events
        // Bound the checks to requestAnimationFrame to prevent layout thrashing and main thread blocking during fast scrolling
        if (!isManualScrollPending) {
            isManualScrollPending = true;
            requestAnimationFrame(() => {
                isManualScrollPending = false;
                if (!isActive) return;

                const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
                if (currentIndex < allImagesUrls.length && pendingImages < BATCH_SIZE && window.scrollY >= maxScroll - 2000) {
                    renderNextBatch(BATCH_SIZE);
                }
            });
        }
    }

    function startAutoScroll() {
        if (!isScrolling && scrollSpeed !== 0) {
            isScrolling = true;
            endDelayStartTime = 0;
            requestAnimationFrame(autoScroll);
        }
    }

    function stopAutoScroll() {
        isScrolling = false;
    }

    function autoScroll() {
        if (!isActive || !isScrolling || scrollSpeed === 0) {
            isScrolling = false;
            return;
        }

        // ⚡ Bolt Optimization: Batch DOM reads before DOM writes to prevent layout thrashing on every frame
        const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        const currentScrollY = window.scrollY;

        window.scrollBy({ top: scrollSpeed, left: 0, behavior: 'instant' });

        if (currentIndex < allImagesUrls.length && pendingImages < BATCH_SIZE && currentScrollY >= maxScroll - 2000) {
            renderNextBatch(BATCH_SIZE);
        }

        if (currentScrollY <= 0 && scrollSpeed < 0) {
            scrollSpeed = 0;
            saveSpeed();
            updateSpeedIndicator();
        } else if (allImagesUrls.length > 0 && pendingImages === 0 && currentScrollY >= maxScroll - 1 && scrollSpeed > 0) {
            // Check if we hit the end of all galleries (in folder-random mode, currentIndex never reaches the end smoothly due to wrap around, but if maxScroll reached it will trigger reload)
            const mode = localStorage.getItem('imageflow_display_mode') || 'gallery';
            const currentSort = mode === 'dual' ? localStorage.getItem('imageflow_dual_sort') : localStorage.getItem('imageflow_gallery_sort');
            const folderRandom = currentSort === 'folder-random';
            
            if (!folderRandom && currentIndex >= allImagesUrls.length) {
                // Actually hit the end
            } else if (!folderRandom) {
                return // Not reached end yet
            }
            
            // Loop reload logic
            if (maxScroll <= 0) {
                if (endDelayStartTime === 0) {
                    endDelayStartTime = performance.now();
                } else if (performance.now() - endDelayStartTime > 3000) {
                    endDelayStartTime = 0;
                    isScrolling = false;
                    if (currentOptions.onEnd) {
                        currentOptions.onEnd();
                    }
                    return;
                }
                
                requestAnimationFrame(autoScroll);
                return;
            }
            
            // Loop reload
            endDelayStartTime = 0;
            isScrolling = false;
            if (currentOptions.onEnd) {
                currentOptions.onEnd();
            }
            return;
        } else {
            endDelayStartTime = 0;
        }

        if (scrollSpeed !== 0) {
            requestAnimationFrame(autoScroll);
        } else {
            isScrolling = false;
            updateSpeedIndicator();
        }
    }

    function changeScrollSpeed(delta) {
        if (isPaused) {
            isPaused = false;
            scrollSpeed = savedSpeedForPause;
        }

        scrollSpeed += delta;
        if (Math.abs(scrollSpeed) < 0.1) scrollSpeed = 0;

        saveSpeed();
        updateSpeedIndicator();

        if (scrollSpeed !== 0 && !isScrolling) {
            startAutoScroll();
        }
    }

    function stop() {
        isPaused = false;
        scrollSpeed = 0;
        saveSpeed();
        isScrolling = false;
        updateSpeedIndicator();
    }

    function togglePause() {
        if (!isPaused) {
            if (scrollSpeed !== 0) {
                savedSpeedForPause = scrollSpeed;
                scrollSpeed = 0;
                saveSpeed(); // Note: Original script saves 0 to localStorage
                isPaused = true;
                updateSpeedIndicator();
            }
        } else {
            isPaused = false;
            scrollSpeed = savedSpeedForPause;
            saveSpeed();
            updateSpeedIndicator();
            if (scrollSpeed !== 0) {
                startAutoScroll();
            }
        }
    }

    function changeColumnCount(delta) {
        const newCount = columnCount + delta;
        if (newCount < 1 || newCount > 10) return;

        // 1. FIRST: 画像の現在位置とサイズを記録
        const imgPositions = new Map();
        let existingItems = [];
        columns.forEach(col => {
            Array.from(col.children).forEach(item => {
                existingItems.push(item);
                imgPositions.set(item, item.getBoundingClientRect());
            });
        });

        // Current scroll center image to anchor around
        const viewCenterY = window.innerHeight / 2;
        let anchorItem = null;
        let minDistance = Infinity;

        existingItems.forEach(item => {
            const rect = imgPositions.get(item);
            if (!rect) return;
            const distance = Math.abs((rect.top + rect.bottom) / 2 - viewCenterY);
            if (distance < minDistance) {
                minDistance = distance;
                anchorItem = item;
            }
        });
        
        // anchorItem の元々の画面内Y座標（中心ベースなど）
        const anchorOldCenterY = anchorItem ? (imgPositions.get(anchorItem).top + imgPositions.get(anchorItem).height / 2) : 0;

        columnCount = newCount;
        localStorage.setItem(STORAGE_KEY_COLUMNS, columnCount);

        existingItems.sort((a, b) => parseInt(a.dataset.index) - parseInt(b.dataset.index));

        // 2. DOMの再構築
        galleryElement.innerHTML = '';
        columns = [];
        columnHeights = new Array(columnCount).fill(0);

        for (let i = 0; i < columnCount; i++) {
            const col = document.createElement('div');
            col.className = 'gallery-col';
            columns.push(col);
            galleryElement.appendChild(col);
        }

        // ⚡ Bolt Optimization: Calculate column width outside the loop to avoid Layout Thrashing
        const baseWidth = galleryElement ? galleryElement.offsetWidth : window.innerWidth;
        const colWidth = (columns[0] && columns[0].offsetWidth) || (baseWidth / columnCount);

        existingItems.forEach(item => {
            const img = item.querySelector('img') || item;
            let shortestIdx = 0;
            let minH = columnHeights[0];
            for (let j = 1; j < columnCount; j++) {
                if (columnHeights[j] < minH) {
                    shortestIdx = j;
                    minH = columnHeights[j];
                }
            }

            const shortestCol = columns[shortestIdx];
            shortestCol.appendChild(item);

            const ratio = (img.naturalHeight && img.naturalWidth) ? (img.naturalHeight / img.naturalWidth) : 1;
            columnHeights[shortestIdx] += (colWidth * ratio);
        });

        // 3. 一旦ブラウザにレイアウトを計算させる為に、アンカー画像の新しい位置に基づいてスクロール位置を復元する
        if (anchorItem) {
            const newAnchorRect = anchorItem.getBoundingClientRect();
            const newAnchorCenterY = newAnchorRect.top + newAnchorRect.height / 2;
            const diffY = newAnchorCenterY - anchorOldCenterY;
            window.scrollBy({ top: diffY, left: 0, behavior: 'instant' });
        }

        // 4. LAST, INVERT, PLAY: アニメーションの実行
        existingItems.forEach(item => {
            const oldPos = imgPositions.get(item);
            if (!oldPos) return;

            const newPos = img.getBoundingClientRect();
            if (newPos.width === 0 || newPos.height === 0 || oldPos.width === 0 || oldPos.height === 0) return;

            const deltaX = oldPos.left - newPos.left;
            const deltaY = oldPos.top - newPos.top;
            const scaleX = oldPos.width / newPos.width;
            const scaleY = oldPos.height / newPos.height;

            // 変化がない場合はスキップ
            if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5 && Math.abs(scaleX - 1) < 0.01 && Math.abs(scaleY - 1) < 0.01) {
                return;
            }

            item.animate([
                {
                    transformOrigin: 'top left',
                    transform: `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})`
                },
                {
                    transformOrigin: 'top left',
                    transform: 'none'
                }
            ], {
                duration: 400,
                easing: 'cubic-bezier(0.25, 1, 0.5, 1)'
            });
        });

        showIndicator(`Columns: ${columnCount}`);
    }

    function saveSpeed() {
        localStorage.setItem(STORAGE_KEY_SPEED, scrollSpeed);
    }

    function updateSpeedIndicator() {
        if (isPaused) {
            showIndicator(`Speed: || Paused`);
        } else {
            const direction = scrollSpeed > 0 ? '▼' : (scrollSpeed < 0 ? '▲' : '■');
            showIndicator(`Speed: ${direction} ${Math.abs(scrollSpeed).toFixed(1)}`);
        }
    }

    function showIndicator(text) {
        if (!speedIndicatorElement) return;
        speedIndicatorElement.textContent = text;
        speedIndicatorElement.style.opacity = '1';

        if (indicatorTimeout) clearTimeout(indicatorTimeout);
        indicatorTimeout = setTimeout(() => {
        }, 1500);
    }

    function setDirection(rtl) {
        isRightToLeft = !!rtl;
        if (galleryElement) {
            if (isRightToLeft) {
                galleryElement.classList.add('rtl');
            } else {
                galleryElement.classList.remove('rtl');
            }
        }
    }

    function toggleDirection() {
        isRightToLeft = !isRightToLeft;
        setDirection(isRightToLeft);
        return isRightToLeft;
    }

    return {
        init,
        enter,
        exit,
        changeScrollSpeed,
        stop,
        togglePause,
        changeColumnCount,
        updateImagesAndReset,
        setDirection,
        toggleDirection,
        get isActive() { return isActive; },
        get scrollSpeed() { return scrollSpeed; },
        get isPaused() { return isPaused; },
        get isRightToLeft() { return isRightToLeft; },
        // Used for mode transitions
        get currentIndex() {
            const imagesInGallery = Array.from(galleryElement.querySelectorAll('.image-wrapper, img')).filter(el => el.parentElement.classList.contains('gallery-col'));
            if (imagesInGallery.length === 0) return currentStartIndex;

            const viewportMiddle = window.innerHeight / 2;
            let closestImg = imagesInGallery[0];
            let minDistance = Infinity;

            let minIdxImg = imagesInGallery[0];
            let minIdx = parseInt(minIdxImg.dataset.index);

            imagesInGallery.forEach(img => {
                const idx = parseInt(img.dataset.index);
                if (idx < minIdx) {
                    minIdx = idx;
                    minIdxImg = img;
                }

                const rect = img.getBoundingClientRect();
                const distance = Math.abs((rect.top + rect.bottom) / 2 - viewportMiddle);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestImg = img;
                }
            });

            if (minIdxImg) {
                const minIdxRect = minIdxImg.getBoundingClientRect();
                if (minIdxRect.top < viewportMiddle && minIdxRect.bottom > 0) {
                    return minIdx;
                }
            }

            return closestImg ? parseInt(closestImg.dataset.index) : 0;
        }
    };
})();
