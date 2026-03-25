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

    // Auto Advance logic
    let advanceInterval = 0; // Seconds
    let advanceTimer = null;
    let isPaused = false;
    let savedIntervalBeforePause = 0;

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

    function render() {
        if (!isActive) return;
        galleryElement.innerHTML = '';

        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.justifyContent = 'center';
        container.style.alignItems = 'center';
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.gap = '0';
        container.style.padding = '0';
        container.style.boxSizing = 'border-box';
        container.style.backgroundColor = '#000';

        for (let i = 0; i < 2; i++) {
            const idx = currentIndex + i;
            if (idx < images.length) {
                const img = document.createElement('img');
                img.src = images[idx];
                // Resize to fit: max 50% width and 100% height of viewport
                img.style.maxWidth = '50%';
                img.style.maxHeight = '100%';
                img.style.width = 'auto'; // Maintain aspect ratio
                img.style.height = 'auto'; // Maintain aspect ratio
                img.style.objectFit = 'contain';
                img.style.opacity = '1';
                img.style.transition = 'none';
                img.style.display = 'block';

                container.appendChild(img);
            }
        }

        galleryElement.appendChild(container);
        resetTimer(); // Restart current interval when manual nav or render happens
    }

    function next() {
        if (currentIndex + 2 < images.length) {
            currentIndex += 2;
            render();
            showIndicator();
        } else {
            showIndicator("最後の一枚です");
            stopTimerByFinish();
        }
    }

    function prev() {
        if (currentIndex - 2 >= 0) {
            currentIndex -= 2;
        } else if (currentIndex > 0) {
            currentIndex = 0;
        } else {
            return;
        }
        render();
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
                indicator.textContent = `Dual View: Auto (${advanceInterval}s) | ${currentIndex + 1}-${Math.min(currentIndex + 2, images.length)} / ${images.length}`;
            } else {
                indicator.textContent = `Dual View: Manual | ${currentIndex + 1}-${Math.min(currentIndex + 2, images.length)} / ${images.length}`;
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

    return {
        init,
        enter,
        exit,
        next,
        prev,
        setAutoAdvance,
        togglePause,
        stop,
        updateImagesAndReset,
        get isActive() { return isActive; },
        get interval() { return advanceInterval; },
        get isPaused() { return isPaused; }
    };
})();
