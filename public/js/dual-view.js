/**
 * Dual View Mode for ImageFlow
 * Displays two images side-by-side filling the viewport.
 */
const DualView = (() => {
    let isActive = false;
    let images = [];
    let currentIndex = 0; // Current pair start index
    let galleryElement = null;
    let oldGalleryStyle = {};
    let onExitCallback = null;
    let currentClickHandler = null;
    let currentWheelHandler = null;

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

    function init() {
        galleryElement = document.getElementById('gallery');
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
            
            const width = window.innerWidth;
            if (e.clientX > width / 2) {
                next();
            } else {
                prev();
            }
        };
        window.addEventListener('click', currentClickHandler);

        // Handle wheel for navigation
        currentWheelHandler = (e) => {
            if (!isActive) return;
            // deltaY > 0 is scroll down (next)
            if (e.deltaY > 0) {
                next();
            } else if (e.deltaY < 0) {
                prev();
            }
        };
        window.addEventListener('wheel', currentWheelHandler, { passive: true });
        
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
        galleryElement.innerHTML = '';

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

        for (let i = 0; i < lastShownCount; i++) {
            const idx = currentIndex + i;
            if (idx < images.length) {
                const img = document.createElement('img');
                img.src = images[idx];
                img.style.width = maxWidth;
                img.style.height = '100%';
                img.style.objectFit = 'contain';
                img.style.display = 'block';
                img.style.opacity = '1';
                img.style.transition = 'none';
                
                if (lastShownCount === 2) {
                    if (isRightToLeft) {
                        img.style.objectPosition = (i === 0) ? 'left' : 'right';
                    } else {
                        img.style.objectPosition = (i === 0) ? 'right' : 'left';
                    }
                } else {
                    img.style.objectPosition = 'center';
                }
                
                container.appendChild(img);
            }
        }

        galleryElement.appendChild(container);
        resetTimer(); 
        
        // Preload next
        preloadDimensions(currentIndex + lastShownCount, 4);
    }

    async function next(step) {
        const moveAmount = (typeof step === 'number') ? step : lastShownCount;
        if (currentIndex + moveAmount < images.length) {
            currentIndex += moveAmount;
        } else if (moveAmount > 1 && currentIndex + 1 < images.length) {
            currentIndex += 1;
        } else {
            // Loop back to start
            currentIndex = 0;
        }
        await render();
        showIndicator();
    }

    async function prev(step) {
        if (currentIndex <= 0) {
            // Loop back to end
            await goToLast();
            return;
        }

        if (typeof step === 'number') {
            currentIndex = Math.max(0, currentIndex - step);
            await render();
            showIndicator();
            return;
        }

        // Determine previous page start (default behavior)
        let prevIndex = currentIndex - 1;
        if (prevIndex > 0) {
            // Check if we can fit two portraits (prevIndex-1 and prevIndex)
            const dimsPrev = await getImageDims(images[prevIndex]);
            const dimsPrevPrev = await getImageDims(images[prevIndex - 1]);
            
            const isPrevPortrait = dimsPrev.width <= dimsPrev.height;
            const isPrevPrevPortrait = dimsPrevPrev.width <= dimsPrevPrev.height;
            
            if (isPrevPortrait && isPrevPrevPortrait) {
                prevIndex = prevIndex - 1;
            }
        }
        
        currentIndex = prevIndex;
        await render();
        showIndicator();
    }

    async function goToFirst() {
        if (!isActive || images.length === 0) return;
        currentIndex = 0;
        await render();
        showIndicator();
    }

    async function goToLast() {
        if (!isActive || images.length === 0) return;
        currentIndex = images.length - 1;
        await render();
        showIndicator();
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
    }

    function stopTimerByFinish() {
        stopTimer();
        advanceInterval = 0; // Reset speed as we reached the end
    }

    function resetTimer() {
        stopTimer();
        if (advanceInterval > 0 && !isPaused) {
            advanceTimer = setTimeout(() => {
                next();
            }, advanceInterval * 1000);
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
            if (customText) {
                indicator.textContent = customText;
            } else if (isPaused) {
                indicator.textContent = `Dual View: Paused (Next in ${advanceInterval}s)`;
            } else if (advanceInterval > 0) {
                const endIdx = Math.min(currentIndex + lastShownCount, images.length);
                indicator.textContent = `Dual View: Auto (${advanceInterval}s) | ${currentIndex + 1}${lastShownCount > 1 ? '-' + endIdx : ''} / ${images.length}`;
            } else {
                const endIdx = Math.min(currentIndex + lastShownCount, images.length);
                indicator.textContent = `Dual View: Manual | ${currentIndex + 1}${lastShownCount > 1 ? '-' + endIdx : ''} / ${images.length}`;
            }
            indicator.style.opacity = '1';
            
            if (window.dualViewTimer) clearTimeout(window.dualViewTimer);
            window.dualViewTimer = setTimeout(() => {
                indicator.style.opacity = '0';
            }, 2000);
        }
    }

    function updateImagesAndReset(newImagesUrls, startIndex = 0) {
        if (!isActive) return;
        images = newImagesUrls;
        currentIndex = startIndex;
        render();
        showIndicator();
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
