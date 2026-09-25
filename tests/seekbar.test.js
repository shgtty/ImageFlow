const test = require('node:test');
const assert = require('node:assert');
const { getFolderBounds, getFolderPath, isCursorInSeekbarHoverArea, isTextInputElement } = require('../public/js/utils.js');

test('Seekbar page count and relative indexing logic', async (t) => {
    const urls = [
        // Folder 1: 3 images
        'http://localhost/image?path=C:\\Photos\\Album1\\01.jpg',
        'http://localhost/image?path=C:\\Photos\\Album1\\02.jpg',
        'http://localhost/image?path=C:\\Photos\\Album1\\03.jpg',
        // Folder 2 (ZIP subfolder): 2 images
        'http://localhost/image?path=C:\\Archive.zip|subfolder/img1.jpg',
        'http://localhost/image?path=C:\\Archive.zip|subfolder/img2.jpg',
        // Folder 3 (ZIP root): 1 image
        'http://localhost/image?path=C:\\Archive.zip|root.jpg',
    ];

    // Helper simulating updateSeekbar logic
    function simulateUpdateSeekbar(currentIndex, currentSort, urls) {
        if (!urls || urls.length === 0) return { max: 0, val: 0, text: '0 / 0' };

        let newMax = 0;
        let newVal = 0;
        let newText = '';

        if (currentSort === 'folder-random' || currentSort === 'asc') {
            const bounds = getFolderBounds(currentIndex, urls);
            newMax = Math.max(0, bounds.total - 1);
            newVal = bounds.relativeIndex;
            newText = `${bounds.relativeIndex + 1} / ${bounds.total}`;
        } else {
            newMax = Math.max(0, urls.length - 1);
            newVal = currentIndex;
            newText = `${currentIndex + 1} / ${urls.length}`;
        }

        return { max: newMax, val: newVal, text: newText };
    }

    // Helper simulating seekbar input/change logic
    function simulateSeekbarInput(sliderVal, currentIndex, currentSort, urls) {
        let absoluteIndex = sliderVal;
        let displayTotal = urls.length;

        if (currentSort === 'folder-random' || currentSort === 'asc') {
            const bounds = getFolderBounds(currentIndex, urls);
            absoluteIndex = bounds.start + sliderVal;
            displayTotal = bounds.total;
        }

        return {
            absoluteIndex,
            displayTotal,
            infoText: `${sliderVal + 1} / ${displayTotal}`
        };
    }

    // Helper simulating seekbar tooltip logic
    function simulateSeekbarHover(pct, currentIndex, currentSort, urls) {
        if (currentSort === 'folder-random' || currentSort === 'asc') {
            const bounds = getFolderBounds(currentIndex, urls);
            const index = Math.round(pct * (bounds.total - 1));
            return `${index + 1} / ${bounds.total}`;
        } else {
            const index = Math.round(pct * (urls.length - 1));
            return `${index + 1} / ${urls.length}`;
        }
    }

    await t.test('asc mode: seekbar reflects folder image count and relative position', () => {
        // Album1, image 1 (index 0)
        let state = simulateUpdateSeekbar(0, 'asc', urls);
        assert.strictEqual(state.max, 2); // 3 images -> max 2
        assert.strictEqual(state.val, 0); // 1st image
        assert.strictEqual(state.text, '1 / 3');

        // Album1, image 3 (index 2)
        state = simulateUpdateSeekbar(2, 'asc', urls);
        assert.strictEqual(state.max, 2);
        assert.strictEqual(state.val, 2);
        assert.strictEqual(state.text, '3 / 3');

        // ZIP subfolder, image 1 (index 3)
        state = simulateUpdateSeekbar(3, 'asc', urls);
        assert.strictEqual(state.max, 1); // 2 images -> max 1
        assert.strictEqual(state.val, 0);
        assert.strictEqual(state.text, '1 / 2');

        // ZIP root, image 1 (index 5)
        state = simulateUpdateSeekbar(5, 'asc', urls);
        assert.strictEqual(state.max, 0); // 1 image -> max 0
        assert.strictEqual(state.val, 0);
        assert.strictEqual(state.text, '1 / 1');
    });

    await t.test('folder-random mode: seekbar reflects folder image count and relative position', () => {
        const state = simulateUpdateSeekbar(1, 'folder-random', urls);
        assert.strictEqual(state.max, 2);
        assert.strictEqual(state.val, 1);
        assert.strictEqual(state.text, '2 / 3');
    });

    await t.test('random mode: seekbar reflects total dataset count', () => {
        const state = simulateUpdateSeekbar(1, 'random', urls);
        assert.strictEqual(state.max, 5); // 6 images -> max 5
        assert.strictEqual(state.val, 1);
        assert.strictEqual(state.text, '2 / 6');
    });

    await t.test('asc mode: seekbar scrubbing maps slider value to folder-relative absolute index', () => {
        // In Album1 (start = 0, total = 3), slider dragged to value 2
        let inputResult = simulateSeekbarInput(2, 0, 'asc', urls);
        assert.strictEqual(inputResult.absoluteIndex, 2);
        assert.strictEqual(inputResult.displayTotal, 3);
        assert.strictEqual(inputResult.infoText, '3 / 3');

        // In ZIP subfolder (start = 3, total = 2), slider dragged to value 1
        inputResult = simulateSeekbarInput(1, 3, 'asc', urls);
        assert.strictEqual(inputResult.absoluteIndex, 4);
        assert.strictEqual(inputResult.displayTotal, 2);
        assert.strictEqual(inputResult.infoText, '2 / 2');
    });

    await t.test('asc mode: seekbar tooltip shows folder-scoped image index and total', () => {
        // Hover at 50% in Album1
        let tipText = simulateSeekbarHover(0.5, 0, 'asc', urls);
        assert.strictEqual(tipText, '2 / 3');

        // Hover at 100% in Album1
        tipText = simulateSeekbarHover(1.0, 0, 'asc', urls);
        assert.strictEqual(tipText, '3 / 3');

        // Hover at 50% in random mode
        tipText = simulateSeekbarHover(0.5, 0, 'random', urls);
        assert.strictEqual(tipText, '4 / 6'); // Math.round(0.5 * 5) = 3 -> index 3 is image 4 of 6
    });

    await t.test('isCursorInSeekbarHoverArea: area "all" detects any X coordinate within bottom threshold', () => {
        const vw = 1920;
        const vh = 1080;
        // Near bottom (dist = 50px <= 90px)
        assert.strictEqual(isCursorInSeekbarHoverArea(100, 1030, vw, vh, { area: 'all' }), true);
        assert.strictEqual(isCursorInSeekbarHoverArea(960, 1030, vw, vh, { area: 'all' }), true);
        assert.strictEqual(isCursorInSeekbarHoverArea(1850, 1030, vw, vh, { area: 'all' }), true);

        // Above threshold (dist = 100px > 90px)
        assert.strictEqual(isCursorInSeekbarHoverArea(960, 980, vw, vh, { area: 'all' }), false);

        // Below screen bottom (clientY > 1080)
        assert.strictEqual(isCursorInSeekbarHoverArea(960, 1090, vw, vh, { area: 'all' }), false);

        // Disabled
        assert.strictEqual(isCursorInSeekbarHoverArea(960, 1030, vw, vh, { enabled: false, area: 'all' }), false);
    });

    await t.test('isCursorInSeekbarHoverArea: area "center" detects only central seekbar span', () => {
        const vw = 1920;
        const vh = 1080;
        // In 1920vw, seekbar width = min(1920 * 0.7, 900) = 900px.
        // Center is 960. Left bound = (1920 - 900)/2 - 20 = 510 - 20 = 490px.
        // Right bound = 510 + 900 + 20 = 1430px.

        // Inside center horizontal span
        assert.strictEqual(isCursorInSeekbarHoverArea(960, 1030, vw, vh, { area: 'center' }), true);
        assert.strictEqual(isCursorInSeekbarHoverArea(500, 1030, vw, vh, { area: 'center' }), true);
        assert.strictEqual(isCursorInSeekbarHoverArea(1420, 1030, vw, vh, { area: 'center' }), true);

        // Outside center horizontal span (edges of screen)
        assert.strictEqual(isCursorInSeekbarHoverArea(100, 1030, vw, vh, { area: 'center' }), false);
        assert.strictEqual(isCursorInSeekbarHoverArea(1800, 1030, vw, vh, { area: 'center' }), false);

        // Default area is 'center' when options.area is omitted
        assert.strictEqual(isCursorInSeekbarHoverArea(960, 1030, vw, vh), true);
        assert.strictEqual(isCursorInSeekbarHoverArea(100, 1030, vw, vh), false);
    });

    await t.test('seekbar hover peek lifecycle simulation (show, delay hide, drag protection)', () => {
        let isUserHidden = true;
        let isPeekVisible = false;
        let isDragging = false;
        let hideTimer = null;

        function showPeek() {
            if (hideTimer) {
                clearTimeout(hideTimer);
                hideTimer = null;
            }
            if (isUserHidden) isPeekVisible = true;
        }

        function scheduleHide(delay = 50) {
            if (isDragging) return;
            if (hideTimer) clearTimeout(hideTimer);
            hideTimer = setTimeout(() => {
                if (!isDragging) isPeekVisible = false;
                hideTimer = null;
            }, delay);
        }

        // 1. Move cursor into bottom area -> show peek
        showPeek();
        assert.strictEqual(isPeekVisible, true);

        // 2. Start dragging slider
        isDragging = true;

        // 3. Move cursor outside -> schedule hide, but dragging prevents hiding
        scheduleHide(10);
        assert.strictEqual(isPeekVisible, true);

        // 4. Release drag outside -> schedule hide triggers
        isDragging = false;
        scheduleHide(10);
        return new Promise((resolve) => {
            setTimeout(() => {
                assert.strictEqual(isPeekVisible, false);
                resolve();
            }, 30);
        });
    });

    await t.test('isTextInputElement correctly classifies input types', () => {
        // Non-text inputs (shortcuts should NOT be blocked)
        assert.strictEqual(isTextInputElement({ tagName: 'INPUT', type: 'range' }), false);
        assert.strictEqual(isTextInputElement({ tagName: 'INPUT', type: 'checkbox' }), false);
        assert.strictEqual(isTextInputElement({ tagName: 'INPUT', type: 'radio' }), false);
        assert.strictEqual(isTextInputElement({ tagName: 'INPUT', type: 'button' }), false);
        assert.strictEqual(isTextInputElement(null), false);
        assert.strictEqual(isTextInputElement({ tagName: 'DIV' }), false);

        // Text inputs (shortcuts SHOULD be blocked)
        assert.strictEqual(isTextInputElement({ tagName: 'INPUT', type: 'text' }), true);
        assert.strictEqual(isTextInputElement({ tagName: 'INPUT', type: 'search' }), true);
        assert.strictEqual(isTextInputElement({ tagName: 'INPUT', type: 'password' }), true);
        assert.strictEqual(isTextInputElement({ tagName: 'INPUT' }), true); // default type is text
        assert.strictEqual(isTextInputElement({ tagName: 'TEXTAREA' }), true);
        assert.strictEqual(isTextInputElement({ tagName: 'DIV', isContentEditable: true }), true);
    });

    await t.test('seekbar drag and change lifecycle blurs seekbar to release keyboard control', () => {
        let activeElement = null;
        let isDraggingSeekbar = false;

        const seekbarMock = {
            tagName: 'INPUT',
            type: 'range',
            focus() {
                activeElement = this;
            },
            blur() {
                if (activeElement === this) {
                    activeElement = null;
                }
            }
        };

        // 1. User starts dragging seekbar (browser focuses range input)
        seekbarMock.focus();
        isDraggingSeekbar = true;
        assert.strictEqual(activeElement, seekbarMock);
        assert.strictEqual(isDraggingSeekbar, true);

        // 2. User releases drag (change event or mouseup triggers)
        function handleChange() {
            isDraggingSeekbar = false;
            seekbarMock.blur();
        }
        function handleMouseUp() {
            if (isDraggingSeekbar) {
                isDraggingSeekbar = false;
                seekbarMock.blur();
            }
        }

        // Test mouseup releasing drag
        handleMouseUp();
        assert.strictEqual(isDraggingSeekbar, false);
        assert.strictEqual(activeElement, null, 'Seekbar must be blurred after mouseup');

        // Test change releasing focus
        seekbarMock.focus();
        assert.strictEqual(activeElement, seekbarMock);
        handleChange();
        assert.strictEqual(activeElement, null, 'Seekbar must be blurred after change event');

        // 3. Failsafe in keydown: if activeElement is still seekbar, blur it immediately
        seekbarMock.focus();
        assert.strictEqual(activeElement, seekbarMock);
        function handleKeyDownFailsafe() {
            if (activeElement === seekbarMock) {
                seekbarMock.blur();
            }
        }
        handleKeyDownFailsafe();
        assert.strictEqual(activeElement, null, 'Failsafe in keydown must blur seekbar if focused');
    });
});
