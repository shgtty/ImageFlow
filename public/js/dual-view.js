/**
 * Dual View Mode for ImageFlow
 * Displays two images side-by-side filling the viewport.
 */
const DualView = (() => {
    let isActive = false;
    let images = [];
    let currentIndex = 0; // Current pair start index
    let galleryElement = null;
    let onExitCallback = null;
    let currentClickHandler = null;
    let currentWheelHandler = null;
    let currentMouseMoveHandler = null;

    // Auto Advance logic
    let advanceInterval = 0; // Seconds
    let advanceTimer = null;
    let isPaused = false;
    let savedIntervalBeforePause = 0;

    // Layout logic
    let isRightToLeft = false;
    let lastShownCount = 1;
    let currentRenderId = 0;
    const dimensionCache = new Map(); // URL -> {width, height}

    // Progress Bar logic
    let progressStartTime = 0;
    let progressAnimationFrameId = null;
    let progressBar = null;
    let progressContainer = null;

    function init() {
        galleryElement = document.getElementById('gallery');
        progressBar = document.getElementById('countdown-progress-bar');
        progressContainer = document.getElementById('countdown-progress-container');
    }

    /**
     * Enter Dual View mode
     * @param {Array} imageUrls - List of all image URLs
     * @param {number} startIndex - Index to start from
     * @param {number} initialInterval - Seconds for auto-advance
     * @param {Function} onExit - Callback when exiting
     */
    function enter(imageUrls, startIndex, initialInterval, onExit) {
        if (isActive) return;
        isActive = true;
        images = imageUrls;
        currentIndex = startIndex;
        onExitCallback = onExit;
        isPaused = false;

        // Apply styles
        document.body.style.overflow = 'hidden';
        galleryElement.innerHTML = '';
        galleryElement.style.display = 'flex';
        galleryElement.style.width = '100%';
        galleryElement.style.height = '100%';
        galleryElement.style.padding = '0';
        galleryElement.style.alignItems = 'center';
        galleryElement.style.justifyContent = 'center';
        galleryElement.style.backgroundColor = '#000';
        galleryElement.style.position = 'fixed';
        galleryElement.style.top = '0';
        galleryElement.style.left = '0';
        galleryElement.style.zIndex = '500';

        render();

        // Start auto-advance if needed
        if (initialInterval > 0) {
            setAutoAdvance(initialInterval);
        }

        // Handle clicks for navigation
        currentClickHandler = (e) => {
            if (!isActive) return;
            if (e.target.closest('.fab')) return;

            // Block clicks if they originated inside a modal (e.g., closing the modal)
            if (e.target.closest('#file-select-modal, #filter-modal, #config-edit-modal, #bookmark-modal')) return;

            // Block clicks if clicking on a video element to allow interacting with controls
            if (e.target.closest('video')) return;

            // Block clicks if a modal is open
            const fileSelectModal = document.getElementById('file-select-modal');
            if (fileSelectModal && fileSelectModal.style.display === 'block') return;
            const filterModal = document.getElementById('filter-modal');
            if (filterModal && filterModal.style.display === 'block') return;
            const configEditModal = document.getElementById('config-edit-modal');
            if (configEditModal && configEditModal.style.display === 'block') return;
            const bookmarkModal = document.getElementById('bookmark-modal');
            if (bookmarkModal && bookmarkModal.style.display === 'block') return;

            const width = window.innerWidth;
            if (e.clientX > width / 2) {
                isRightToLeft ? prev() : next();
            } else {
                isRightToLeft ? next() : prev();
            }
        };
        window.addEventListener('click', currentClickHandler);

        // Handle wheel for navigation
        let lastWheelTime = 0;
        currentWheelHandler = (e) => {
            if (!isActive) return;

            // Block wheel if a modal is open
            const fileSelectModal = document.getElementById('file-select-modal');
            if (fileSelectModal && fileSelectModal.style.display === 'block') return;
            const filterModal = document.getElementById('filter-modal');
            if (filterModal && filterModal.style.display === 'block') return;
            const configEditModal = document.getElementById('config-edit-modal');
            if (configEditModal && configEditModal.style.display === 'block') return;
            const bookmarkModal = document.getElementById('bookmark-modal');
            if (bookmarkModal && bookmarkModal.style.display === 'block') return;

            // ⚡ Bolt Optimization: Throttle high-frequency wheel events to prevent redundant image fetch requests and layout thrashing
            const now = Date.now();
            if (now - lastWheelTime < 10) return;
            lastWheelTime = now;

            // deltaY > 0 is scroll down (next)
            if (e.deltaY > 0) {
                next();
            } else if (e.deltaY < 0) {
                prev();
            }
        };
        window.addEventListener('wheel', currentWheelHandler, { passive: true });

        // Handle mouse move for custom left/right arrow cursors
        currentMouseMoveHandler = (e) => {
            if (!isActive) return;

            // Block custom cursor if a modal is open
            const fileSelectModal = document.getElementById('file-select-modal');
            if (fileSelectModal && fileSelectModal.style.display === 'block') { galleryElement.style.cursor = ''; return; }
            const filterModal = document.getElementById('filter-modal');
            if (filterModal && filterModal.style.display === 'block') { galleryElement.style.cursor = ''; return; }
            const configEditModal = document.getElementById('config-edit-modal');
            if (configEditModal && configEditModal.style.display === 'block') { galleryElement.style.cursor = ''; return; }
            const bookmarkModal = document.getElementById('bookmark-modal');
            if (bookmarkModal && bookmarkModal.style.display === 'block') { galleryElement.style.cursor = ''; return; }

            // Block custom cursor if hovering over UI elements
            if (e.target.closest('.fab, #seekbar-container, .bookmark-star-btn')) {
                galleryElement.style.cursor = '';
                return;
            }

            const width = window.innerWidth;
            if (e.clientX > width / 2) {
                // Right side (Right arrow, solid block shape)
                galleryElement.style.cursor = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 24 24' fill='white' stroke='black' stroke-width='1.5' stroke-linejoin='round'%3E%3Cpath d='M 12 3 L 22 12 L 12 21 L 12 16 L 2 16 L 2 8 L 12 8 Z'/%3E%3C/svg%3E\") 16 16, pointer";
            } else {
                // Left side (Left arrow, solid block shape)
                galleryElement.style.cursor = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 24 24' fill='white' stroke='black' stroke-width='1.5' stroke-linejoin='round'%3E%3Cpath d='M 12 3 L 2 12 L 12 21 L 12 16 L 22 16 L 22 8 L 12 8 Z'/%3E%3C/svg%3E\") 16 16, pointer";
            }
        };
        window.addEventListener('mousemove', currentMouseMoveHandler);

        showIndicator();
    }

    function exit() {
        if (!isActive) return;
        isActive = false;

        stopTimer();

        if (currentClickHandler) {
            window.removeEventListener('click', currentClickHandler);
            currentClickHandler = null;
        }
        if (currentWheelHandler) {
            window.removeEventListener('wheel', currentWheelHandler);
            currentWheelHandler = null;
        }
        if (currentMouseMoveHandler) {
            window.removeEventListener('mousemove', currentMouseMoveHandler);
            currentMouseMoveHandler = null;
        }

        // Restore styles
        document.body.style.overflow = '';
        galleryElement.style.display = '';
        galleryElement.style.flexDirection = '';
        galleryElement.style.height = '';
        galleryElement.style.overflow = '';
        galleryElement.style.width = '';
        galleryElement.style.alignItems = '';
        galleryElement.style.justifyContent = '';
        galleryElement.style.backgroundColor = '';
        galleryElement.style.position = '';
        galleryElement.style.top = '';
        galleryElement.style.left = '';
        galleryElement.style.zIndex = '';
        galleryElement.style.padding = '';
        galleryElement.innerHTML = '';

        if (onExitCallback) onExitCallback(currentIndex);
    }

    async function getImageDims(url) {
        if (!url) return { width: 1, height: 1 };
        if (dimensionCache.has(url)) {
            const cached = dimensionCache.get(url);
            if (cached instanceof Promise) return cached;
            return cached;
        }

        const promise = new Promise((resolve) => {
            const isVideo = typeof isVideoUrl === 'function' ? isVideoUrl(url) : false;
            if (isVideo) {
                const video = document.createElement('video');
                video.preload = 'metadata';
                video.onloadedmetadata = () => {
                    const dims = { width: video.videoWidth, height: video.videoHeight };
                    dimensionCache.set(url, dims);
                    resolve(dims);
                };
                video.onerror = () => {
                    const dims = { width: 16, height: 9 };
                    dimensionCache.set(url, dims);
                    resolve(dims);
                };
                video.src = url;
            } else {
                const img = new Image();
                img.onload = () => {
                    const dims = { width: img.naturalWidth, height: img.naturalHeight };
                    dimensionCache.set(url, dims);
                    resolve(dims);
                };
                img.onerror = () => {
                    const dims = { width: 1, height: 1 };
                    dimensionCache.set(url, dims);
                    resolve(dims);
                };
                img.src = url;
            }
        });
        dimensionCache.set(url, promise);
        return promise;
    }

    function preloadDimensions(startIndex, count) {
        for (let i = 0; i < count; i++) {
            const idx = startIndex + i;
            if (idx < images.length) {
                getImageDims(images[idx]);
            }
        }
    }

    async function calculatePageInfo(index) {
        if (index >= images.length) return { count: 0 };
        const dims1 = await getImageDims(images[index]);
        if (dims1.width > dims1.height) return { count: 1 }; // Landscape is always 1

        if (index + 1 < images.length) {
            const dims2 = await getImageDims(images[index + 1]);
            if (dims2.width > dims2.height) return { count: 1 }; // Next is landscape, so show current (portrait) alone
            return { count: 2 }; // Both portrait
        }
        return { count: 1 };
    }

    async function render() {
        if (!isActive) return;

        const renderId = ++currentRenderId;
        const pageInfo = await calculatePageInfo(currentIndex);

        if (renderId !== currentRenderId || !isActive) return;

        lastShownCount = pageInfo.count;

        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.justifyContent = 'center';
        container.style.alignItems = 'center';
        container.style.flexDirection = isRightToLeft ? 'row-reverse' : 'row';
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.gap = '0';
        container.style.padding = '0';
        container.style.boxSizing = 'border-box';
        container.style.backgroundColor = '#000';

        const maxWidth = lastShownCount === 1 ? '100%' : '50%';
        const loadPromises = [];

        for (let i = 0; i < lastShownCount; i++) {
            const idx = currentIndex + i;
            if (idx < images.length) {
                const cell = document.createElement('div');
                cell.style.width = maxWidth;
                cell.style.height = '100%';
                cell.style.display = 'flex';
                cell.style.alignItems = 'center';

                if (lastShownCount === 2) {
                    if (isRightToLeft) {
                        cell.style.justifyContent = (i === 0) ? 'flex-start' : 'flex-end';
                    } else {
                        cell.style.justifyContent = (i === 0) ? 'flex-end' : 'flex-start';
                    }
                } else {
                    cell.style.justifyContent = 'center';
                }

                // Get dimensions to set aspect ratio
                const dimsPromise = getImageDims(images[idx]);
                
                const wrapper = document.createElement('div');
                wrapper.className = 'image-wrapper';
                wrapper.style.maxWidth = '100%';
                wrapper.style.maxHeight = '100vh';
                // width will be set after dims are loaded

                const isVideo = typeof isVideoUrl === 'function' ? isVideoUrl(images[idx]) : false;
                const img = document.createElement(isVideo ? 'video' : 'img');
                if (isVideo) {
                    img.muted = true;
                    img.autoplay = true;
                    img.loop = true;
                    img.playsInline = true;
                    img.addEventListener('mouseenter', () => {
                        img.controls = true;
                    });
                    img.addEventListener('mouseleave', () => {
                        if (img.seeking) {
                            const checkHide = () => {
                                if (!img.matches(':hover') && !img.seeking) {
                                    img.controls = false;
                                    img.removeEventListener('seeked', checkHide);
                                }
                            };
                            img.addEventListener('seeked', checkHide);
                        } else {
                            img.controls = false;
                        }
                    });
                }

                const loadPromise = new Promise(async (resolve) => {
                    if (isVideo) {
                        img.onloadeddata = resolve;
                        img.onerror = resolve;
                    } else {
                        img.onload = resolve;
                        img.onerror = resolve;
                    }
                    img.src = images[idx];
                    
                    try {
                        const dims = await dimsPromise;
                        if (dims && dims.width && dims.height) {
                            wrapper.style.aspectRatio = `${dims.width} / ${dims.height}`;
                            wrapper.style.width = `min(100%, calc(100vh * (${dims.width} / ${dims.height})))`;
                        } else {
                            wrapper.style.width = '100%';
                            wrapper.style.height = '100%';
                        }
                    } catch(e) {
                        wrapper.style.width = '100%';
                        wrapper.style.height = '100%';
                    }
                    
                    if (!isVideo && img.complete) {
                        resolve();
                    }
                });
                loadPromises.push(loadPromise);

                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'contain';
                img.style.display = 'block';
                img.style.opacity = '1';
                img.style.transition = 'none';
                if (!isVideo) {
                    img.alt = typeof getFilename === 'function' ? getFilename(images[idx]) : 'Image ' + (idx + 1);
                }

                wrapper.appendChild(img);
                if (typeof window.createBookmarkButton === 'function') {
                    const btn = window.createBookmarkButton(images[idx]);
                    wrapper.appendChild(btn);
                }

                cell.appendChild(wrapper);
                container.appendChild(cell);
            }
        }

        await Promise.all(loadPromises);

        if (renderId !== currentRenderId || !isActive) return;

        galleryElement.innerHTML = '';
        galleryElement.appendChild(container);
        resetTimer();

        // Preload next
        preloadDimensions(currentIndex + lastShownCount, 4);
    }

    async function next(step, silent = false) {
        const moveAmount = (typeof step === 'number') ? step : lastShownCount;
        const mode = localStorage.getItem('imageflow_display_mode') || 'gallery';
        const currentSort = mode === 'dual' ? localStorage.getItem('imageflow_dual_sort') : localStorage.getItem('imageflow_gallery_sort');
        const folderRandom = currentSort === 'folder-random';
        
        let nextIndex = currentIndex;
        if (currentIndex + moveAmount < images.length) {
            nextIndex += moveAmount;
        } else if (moveAmount > 1 && currentIndex + 1 < images.length) {
            nextIndex += 1;
        } else {
            nextIndex = 0;
        }

        if (folderRandom && typeof getFolderBounds === 'function') {
            const bounds = getFolderBounds(currentIndex, images);
            if (nextIndex === 0 || nextIndex < bounds.start || nextIndex > bounds.end) {
                // Loop back to the start of the current folder
                nextIndex = bounds.start;
            }
        }

        currentIndex = nextIndex;
        await render();
        if (!silent) showIndicator();
    }

    async function prev(step, silent = false) {
        const mode = localStorage.getItem('imageflow_display_mode') || 'gallery';
        const currentSort = mode === 'dual' ? localStorage.getItem('imageflow_dual_sort') : localStorage.getItem('imageflow_gallery_sort');
        const folderRandom = currentSort === 'folder-random';

        let targetIndex;
        if (currentIndex <= 0) {
            targetIndex = images.length - 1;
        } else if (typeof step === 'number') {
            targetIndex = Math.max(0, currentIndex - step);
        } else {
            let prevIndex = currentIndex - 1;
            if (prevIndex > 0) {
                const dimsPrev = await getImageDims(images[prevIndex]);
                const dimsPrevPrev = await getImageDims(images[prevIndex - 1]);
                const isPrevPortrait = dimsPrev.width <= dimsPrev.height;
                const isPrevPrevPortrait = dimsPrevPrev.width <= dimsPrevPrev.height;
                if (isPrevPortrait && isPrevPrevPortrait) {
                    prevIndex = prevIndex - 1;
                }
            }
            targetIndex = prevIndex;
        }

        if (folderRandom && typeof getFolderBounds === 'function') {
            const bounds = getFolderBounds(currentIndex, images);
            if (targetIndex === images.length - 1 || targetIndex < bounds.start || targetIndex > bounds.end) {
                // Loop forward to the end of the current folder
                targetIndex = bounds.end;
            }
        }

        currentIndex = targetIndex;
        await render();
        if (!silent) showIndicator();
    }

    async function goToFirst(silent = false) {
        if (!isActive || images.length === 0) return;
        currentIndex = 0;
        await render();
        if (!silent) showIndicator();
    }

    async function goToLast(silent = false) {
        if (!isActive || images.length === 0) return;
        currentIndex = images.length - 1;
        await render();
        if (!silent) showIndicator();
    }

    // --- Auto Advance Implementation ---

    function setAutoAdvance(seconds) {
        advanceInterval = seconds;
        isPaused = false;
        if (seconds > 0) {
            resetTimer();
        } else {
            stopTimer();
        }
        showIndicator();
    }

    function stopTimer() {
        if (advanceTimer) {
            clearTimeout(advanceTimer);
            advanceTimer = null;
        }
        if (progressAnimationFrameId) {
            cancelAnimationFrame(progressAnimationFrameId);
            progressAnimationFrameId = null;
        }
        if (progressContainer) progressContainer.style.display = 'none';
    }

    function stopTimerByFinish() {
        stopTimer();
        advanceInterval = 0; // Reset speed as we reached the end
    }

    function resetTimer() {
        stopTimer();
        if (images.length > 0 && advanceInterval > 0 && !isPaused) {
            progressStartTime = Date.now();
            if (progressContainer) progressContainer.style.display = 'block';
            updateProgressBar();

            advanceTimer = setTimeout(() => {
                next();
            }, advanceInterval * 1000);
        }
    }

    function updateProgressBar() {
        if (!isActive || isPaused || advanceInterval <= 0) {
            if (progressAnimationFrameId) {
                cancelAnimationFrame(progressAnimationFrameId);
                progressAnimationFrameId = null;
            }
            return;
        }

        const elapsed = Date.now() - progressStartTime;
        const duration = advanceInterval * 1000;
        const progress = Math.min(100, (elapsed / duration) * 100);
        const remaining = 100 - progress;

        if (progressBar) {
            progressBar.style.width = `${remaining}%`;
        }

        if (progress < 100) {
            progressAnimationFrameId = requestAnimationFrame(updateProgressBar);
        } else {
            progressAnimationFrameId = null;
        }
    }

    function togglePause() {
        if (!isActive) return;
        if (!isPaused) {
            isPaused = true;
            savedIntervalBeforePause = advanceInterval;
            stopTimer();
        } else {
            isPaused = false;
            advanceInterval = savedIntervalBeforePause;
            resetTimer();
        }
        showIndicator();
    }

    function stop() {
        isPaused = false;
        advanceInterval = 0;
        stopTimer();
        showIndicator();
    }

    function showIndicator(customText) {
        const indicator = document.getElementById('speed-indicator');
        if (indicator) {
            let displayIndex = currentIndex;
            let displayEndIdx = Math.min(currentIndex + lastShownCount, images.length);
            let displayTotal = images.length;

            const mode = localStorage.getItem('imageflow_display_mode') || 'gallery';
            const currentSort = mode === 'dual' ? localStorage.getItem('imageflow_dual_sort') : localStorage.getItem('imageflow_gallery_sort');
            
            if (currentSort === 'folder-random' && typeof getFolderBounds === 'function') {
                const bounds = getFolderBounds(currentIndex, images);
                displayIndex = bounds.relativeIndex;
                displayTotal = bounds.total;
                // Since dual view can straddle folder bounds, cap endIdx at folder size
                displayEndIdx = Math.min(displayIndex + lastShownCount, displayTotal);
            }

            if (customText) {
                indicator.textContent = customText;
            } else if (isPaused) {
                indicator.textContent = `Dual View: Paused (Next in ${advanceInterval}s)`;
            } else if (advanceInterval > 0) {
                indicator.textContent = `Dual View: Auto (${advanceInterval}s) | ${displayIndex + 1}${lastShownCount > 1 ? '-' + displayEndIdx : ''} / ${displayTotal}`;
            } else {
                indicator.textContent = `Dual View: Manual | ${displayIndex + 1}${lastShownCount > 1 ? '-' + displayEndIdx : ''} / ${displayTotal}`;
            }
            indicator.style.opacity = '1';

            if (window.dualViewTimer) clearTimeout(window.dualViewTimer);
            window.dualViewTimer = setTimeout(() => {
                indicator.style.opacity = '0';
            }, 2000);
        }
    }

    function updateImagesAndReset(newImagesUrls, startIndex = 0, silent = false) {
        if (!isActive) return;
        images = newImagesUrls;
        currentIndex = startIndex;
        render();
        if (!silent) showIndicator();
    }

    function toggleDirection() {
        isRightToLeft = !isRightToLeft;
        render();
        return isRightToLeft;
    }

    function setDirection(rtl) {
        isRightToLeft = !!rtl;
        if (isActive) render();
    }

    return {
        init,
        enter,
        exit,
        next,
        prev,
        goToFirst,
        goToLast,
        setAutoAdvance,
        togglePause,
        stop,
        updateImagesAndReset,
        toggleDirection,
        setDirection,
        get isActive() { return isActive; },
        get interval() { return advanceInterval; },
        get isPaused() { return isPaused; },
        get currentIndex() { return currentIndex; },
        get isRightToLeft() { return isRightToLeft; }
    };
})();
