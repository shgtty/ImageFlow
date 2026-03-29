/**
 * Gallery View Mode for ImageFlow
 * Displays images in a multi-column masonry-style layout.
 */
const GalleryView = (() => {
    let isActive = false;
    let galleryElement = null;
    let statusElement = null;
    let statusBarElement = null;
    let speedIndicatorElement = null;

    let allImagesUrls = [];
    let currentIndex = 0;
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

    // Storage keys
    const STORAGE_KEY_SPEED = 'imageflow_scroll_speed';
    const STORAGE_KEY_COLUMNS = 'imageflow_column_count';

    function init() {
        galleryElement = document.getElementById('gallery');
        statusElement = document.getElementById('status');
        statusBarElement = document.getElementById('status-bar');
        speedIndicatorElement = document.getElementById('speed-indicator');

        // Initial values from localStorage
        columnCount = parseInt(localStorage.getItem(STORAGE_KEY_COLUMNS)) || 3;
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
        if (currentIndex >= allImagesUrls.length) return;

        const max = Math.min(currentIndex + count, allImagesUrls.length);
        pendingImages += (max - currentIndex);

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
    }

    function handleManualScroll() {
        if (!isActive) return;
        const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        if (currentIndex < allImagesUrls.length && pendingImages < BATCH_SIZE && window.scrollY >= maxScroll - 2000) {
            renderNextBatch(BATCH_SIZE);
        }
    }

    function startAutoScroll() {
        if (!isScrolling && scrollSpeed !== 0) {
            isScrolling = true;
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

        window.scrollBy({ top: scrollSpeed, left: 0, behavior: 'instant' });

        const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

        if (currentIndex < allImagesUrls.length && pendingImages < BATCH_SIZE && window.scrollY >= maxScroll - 2000) {
            renderNextBatch(BATCH_SIZE);
        }

        if (window.scrollY <= 0 && scrollSpeed < 0) {
            scrollSpeed = 0;
            saveSpeed();
            updateSpeedIndicator();
        } else if (currentIndex >= allImagesUrls.length && window.scrollY >= maxScroll - 1 && scrollSpeed > 0) {
            // Loop reload
            if (currentOptions.onEnd) {
                currentOptions.onEnd();
            }
            isScrolling = false;
            return;
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

        columnCount = newCount;
        localStorage.setItem(STORAGE_KEY_COLUMNS, columnCount);

        let existingImages = [];
        columns.forEach(col => {
            existingImages.push(...Array.from(col.children));
        });

        existingImages.sort((a, b) => parseInt(a.dataset.index) - parseInt(b.dataset.index));

        galleryElement.innerHTML = '';
        columns = [];
        columnHeights = new Array(columnCount).fill(0);

        for (let i = 0; i < columnCount; i++) {
            const col = document.createElement('div');
            col.className = 'gallery-col';
            columns.push(col);
            galleryElement.appendChild(col);
        }

        existingImages.forEach(img => {
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

            const ratio = (img.naturalHeight && img.naturalWidth) ? (img.naturalHeight / img.naturalWidth) : 1;
            const colWidth = shortestCol.offsetWidth || (window.innerWidth / columnCount);
            columnHeights[shortestIdx] += (colWidth * ratio);
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
            const imagesInGallery = Array.from(galleryElement.querySelectorAll('img'));
            if (imagesInGallery.length === 0) return 0;

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

            return closestImg ? parseInt(closestImg.dataset.index) : 0;
        }
    };
})();
