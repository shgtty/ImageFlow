const test = require('node:test');
const assert = require('node:assert');
const { getFolderBounds, getFolderPath } = require('../public/js/utils.js');

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
});
