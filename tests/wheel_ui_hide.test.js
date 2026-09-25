const test = require('node:test');
const assert = require('node:assert');

test('Wheel UI and Tooltip auto-hide logic', async (t) => {
    // Mock environment representing script.js state
    let activityTimeout = null;
    let lastActivityReset = 0;
    let isFolderDrawerOpen = false;
    let currentModeMessage = '';

    const fabContainer = {
        classList: {
            classes: new Set(),
            add(cls) { this.classes.add(cls); },
            remove(cls) { this.classes.delete(cls); },
            contains(cls) { return this.classes.has(cls); }
        }
    };

    const documentElement = {
        classList: {
            classes: new Set(),
            add(cls) { this.classes.add(cls); },
            remove(cls) { this.classes.delete(cls); },
            contains(cls) { return this.classes.has(cls); }
        }
    };

    const cursorTooltip = {
        style: { opacity: '1' },
        dataset: { currentSrc: 'test.jpg' }
    };

    const seekbarTooltip = {
        style: { opacity: '1' }
    };

    const modeOverlay = {
        classList: {
            classes: new Set(['show']),
            add(cls) { this.classes.add(cls); },
            remove(cls) { this.classes.delete(cls); },
            contains(cls) { return this.classes.has(cls); }
        }
    };

    const modals = {
        fileSelect: { style: { display: 'none' } },
        filter: { style: { display: 'none' } },
        configEdit: { style: { display: 'none' } },
        bookmark: { style: { display: 'none' } },
        settings: { style: { display: 'none' } }
    };

    function hideUI() {
        if (isFolderDrawerOpen) {
            return;
        }
        if (activityTimeout) {
            clearTimeout(activityTimeout);
            activityTimeout = null;
        }
        fabContainer.classList.add('hidden');
        documentElement.classList.add('hide-cursor');

        // Hide cursor tooltip
        if (cursorTooltip) {
            cursorTooltip.style.opacity = '0';
            cursorTooltip.dataset.currentSrc = '';
        }

        // Hide seekbar tooltip
        if (seekbarTooltip) {
            seekbarTooltip.style.opacity = '0';
        }

        // Hide status overlay
        if (modeOverlay) {
            modeOverlay.classList.remove('show');
            currentModeMessage = '';
        }

        lastActivityReset = 0;
    }

    function resetActivityTimer() {
        const now = Date.now();
        if (now - lastActivityReset < 250) return;
        lastActivityReset = now;

        fabContainer.classList.remove('hidden');
        documentElement.classList.remove('hide-cursor');

        if (modeOverlay) {
            if (!currentModeMessage) {
                modeOverlay.classList.add('show');
            }
        }

        if (activityTimeout) clearTimeout(activityTimeout);
        activityTimeout = setTimeout(hideUI, 3000);
    }

    function handleWheel(e) {
        if (isFolderDrawerOpen) return;
        if (e.target && e.target.closest && e.target.closest('#folder-drawer, #drawer-hover-trigger, .modal')) return;
        if (modals.fileSelect.style.display === 'block') return;
        if (modals.filter.style.display === 'block') return;
        if (modals.configEdit.style.display === 'block') return;
        if (modals.bookmark.style.display === 'block') return;
        if (modals.settings.style.display === 'block') return;

        hideUI();
    }

    // Reset initial UI state to shown
    resetActivityTimer();
    assert.strictEqual(fabContainer.classList.contains('hidden'), false);
    assert.strictEqual(documentElement.classList.contains('hide-cursor'), false);
    assert.strictEqual(modeOverlay.classList.contains('show'), true);

    await t.test('wheel event hides fab buttons and tooltips immediately', () => {
        cursorTooltip.style.opacity = '1';
        cursorTooltip.dataset.currentSrc = 'image.png';
        seekbarTooltip.style.opacity = '1';

        handleWheel({ target: { closest: () => null } });

        assert.strictEqual(fabContainer.classList.contains('hidden'), true, 'FAB container should have hidden class');
        assert.strictEqual(documentElement.classList.contains('hide-cursor'), true, 'documentElement should have hide-cursor class');
        assert.strictEqual(cursorTooltip.style.opacity, '0', 'cursorTooltip opacity should be 0');
        assert.strictEqual(cursorTooltip.dataset.currentSrc, '', 'cursorTooltip currentSrc should be reset');
        assert.strictEqual(seekbarTooltip.style.opacity, '0', 'seekbarTooltip opacity should be 0');
        assert.strictEqual(modeOverlay.classList.contains('show'), false, 'modeOverlay should not have show class');
    });

    await t.test('wheel event over modal or folder-drawer does not hide UI', () => {
        // Reset to visible
        resetActivityTimer();
        assert.strictEqual(fabContainer.classList.contains('hidden'), false);

        // Wheel over folder drawer
        handleWheel({ target: { closest: (sel) => sel.includes('#folder-drawer') ? {} : null } });
        assert.strictEqual(fabContainer.classList.contains('hidden'), false, 'UI should not be hidden when wheel is over drawer');

        // Wheel when modal is open
        modals.settings.style.display = 'block';
        handleWheel({ target: { closest: () => null } });
        assert.strictEqual(fabContainer.classList.contains('hidden'), false, 'UI should not be hidden when modal is open');
        modals.settings.style.display = 'none';
    });

    await t.test('wheel event does not reset activity timer (remains hidden)', () => {
        hideUI();
        assert.strictEqual(fabContainer.classList.contains('hidden'), true);
        assert.strictEqual(documentElement.classList.contains('hide-cursor'), true);

        // Firing wheel event should NOT unhide UI
        handleWheel({ target: { closest: () => null } });
        assert.strictEqual(fabContainer.classList.contains('hidden'), true);
        assert.strictEqual(documentElement.classList.contains('hide-cursor'), true);
    });

    function handleKeyDown(e, isDualViewActive = true, activeEl = null) {
        const isTextInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);
        if (isTextInput) return;

        const isNavKey = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key);
        if (isDualViewActive && isNavKey) {
            hideUI();
            return;
        }
        resetActivityTimer();
    }

    await t.test('dual view cursor key press hides UI immediately even if currently shown', () => {
        // Show UI first
        resetActivityTimer();
        assert.strictEqual(fabContainer.classList.contains('hidden'), false);
        assert.strictEqual(documentElement.classList.contains('hide-cursor'), false);

        // Press ArrowRight in DualView
        handleKeyDown({ key: 'ArrowRight' }, true);
        assert.strictEqual(fabContainer.classList.contains('hidden'), true);
        assert.strictEqual(documentElement.classList.contains('hide-cursor'), true);
        assert.strictEqual(cursorTooltip.style.opacity, '0');

        // Show UI again and test ArrowUp
        resetActivityTimer();
        assert.strictEqual(fabContainer.classList.contains('hidden'), false);
        handleKeyDown({ key: 'ArrowUp' }, true);
        assert.strictEqual(fabContainer.classList.contains('hidden'), true);
    });

    await t.test('gallery view or non-nav key resets activity timer instead of hiding', () => {
        hideUI();
        assert.strictEqual(fabContainer.classList.contains('hidden'), true);

        // Non-nav key in DualView
        handleKeyDown({ key: 'm' }, true);
        assert.strictEqual(fabContainer.classList.contains('hidden'), false);

        hideUI();
        // Nav key in GalleryView (isDualViewActive = false)
        handleKeyDown({ key: 'ArrowDown' }, false);
        assert.strictEqual(fabContainer.classList.contains('hidden'), false);
    });

    await t.test('cursor keys inside text input do not hide UI', () => {
        resetActivityTimer();
        assert.strictEqual(fabContainer.classList.contains('hidden'), false);

        handleKeyDown({ key: 'ArrowRight' }, true, { tagName: 'INPUT' });
        assert.strictEqual(fabContainer.classList.contains('hidden'), false);
    });

    if (activityTimeout) clearTimeout(activityTimeout);
});
