const test = require('node:test');
const assert = require('node:assert');

test('Dual view image click UI hide and silent navigation logic', async (t) => {
    let activityTimeout = null;
    let lastActivityReset = 0;
    let isFolderDrawerOpen = false;
    let currentModeMessage = '';
    let isDualViewActive = true;

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

    const speedIndicator = {
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

        if (cursorTooltip) {
            cursorTooltip.style.opacity = '0';
            cursorTooltip.dataset.currentSrc = '';
        }

        if (seekbarTooltip) {
            seekbarTooltip.style.opacity = '0';
        }

        if (speedIndicator) {
            speedIndicator.style.opacity = '0';
        }

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

    function isDualViewNavClick(e) {
        if (!isDualViewActive) return false;
        if (e.button !== undefined && e.button !== 0) return false;

        if (e.target && e.target.closest) {
            if (e.target.closest('.fab, #folder-drawer, #drawer-hover-trigger, #seekbar-container, .bookmark-star-btn, video, audio, input, textarea, select, button, label, a')) {
                return false;
            }
            if (e.target.closest('#file-select-modal, #filter-modal, #config-edit-modal, #bookmark-modal, #settings-modal, .modal')) {
                return false;
            }
        }

        if (modals.fileSelect.style.display === 'block') return false;
        if (modals.filter.style.display === 'block') return false;
        if (modals.configEdit.style.display === 'block') return false;
        if (modals.bookmark.style.display === 'block') return false;
        if (modals.settings.style.display === 'block') return false;

        return true;
    }

    function handlePointerDown(e) {
        if (isDualViewNavClick(e)) {
            hideUI();
            return;
        }
        resetActivityTimer();
    }

    await t.test('isDualViewNavClick identifies valid dual view navigation clicks', () => {
        isDualViewActive = true;
        assert.strictEqual(isDualViewNavClick({ button: 0, target: { closest: () => null } }), true);
        assert.strictEqual(isDualViewNavClick({ target: { closest: () => null } }), true); // touch event (button is undefined)

        // Middle and right clicks
        assert.strictEqual(isDualViewNavClick({ button: 1, target: { closest: () => null } }), false);
        assert.strictEqual(isDualViewNavClick({ button: 2, target: { closest: () => null } }), false);

        // UI elements
        assert.strictEqual(isDualViewNavClick({ button: 0, target: { closest: (s) => s.includes('.fab') ? {} : null } }), false);
        assert.strictEqual(isDualViewNavClick({ button: 0, target: { closest: (s) => s.includes('#seekbar-container') ? {} : null } }), false);
        assert.strictEqual(isDualViewNavClick({ button: 0, target: { closest: (s) => s.includes('video') ? {} : null } }), false);
        assert.strictEqual(isDualViewNavClick({ button: 0, target: { closest: (s) => s.includes('#folder-drawer') ? {} : null } }), false);

        // Modal open
        modals.fileSelect.style.display = 'block';
        assert.strictEqual(isDualViewNavClick({ button: 0, target: { closest: () => null } }), false);
        modals.fileSelect.style.display = 'none';

        // Dual view inactive
        isDualViewActive = false;
        assert.strictEqual(isDualViewNavClick({ button: 0, target: { closest: () => null } }), false);
        isDualViewActive = true;
    });

    await t.test('clicking image in dual view does not show UI and hides if visible', () => {
        isDualViewActive = true;

        // 1. When UI is already hidden, clicking image keeps UI hidden
        hideUI();
        assert.strictEqual(fabContainer.classList.contains('hidden'), true);
        handlePointerDown({ button: 0, target: { closest: () => null } });
        assert.strictEqual(fabContainer.classList.contains('hidden'), true, 'UI should stay hidden on navigation click');
        assert.strictEqual(documentElement.classList.contains('hide-cursor'), true);

        // 2. When UI is currently visible, clicking image immediately hides UI
        resetActivityTimer();
        assert.strictEqual(fabContainer.classList.contains('hidden'), false);
        handlePointerDown({ button: 0, target: { closest: () => null } });
        assert.strictEqual(fabContainer.classList.contains('hidden'), true, 'UI should be hidden immediately on navigation click');
        assert.strictEqual(documentElement.classList.contains('hide-cursor'), true);
        assert.strictEqual(speedIndicator.style.opacity, '0');
    });

    await t.test('clicking FAB or UI elements in dual view resets activity timer and shows UI', () => {
        isDualViewActive = true;
        hideUI();
        assert.strictEqual(fabContainer.classList.contains('hidden'), true);

        // Click on FAB
        handlePointerDown({ button: 0, target: { closest: (s) => s.includes('.fab') ? {} : null } });
        assert.strictEqual(fabContainer.classList.contains('hidden'), false, 'Clicking FAB should show UI');
    });

    await t.test('clicking in gallery view resets activity timer and shows UI', () => {
        isDualViewActive = false;
        hideUI();
        assert.strictEqual(fabContainer.classList.contains('hidden'), true);

        handlePointerDown({ button: 0, target: { closest: () => null } });
        assert.strictEqual(fabContainer.classList.contains('hidden'), false, 'Clicking in gallery view should show UI');
    });

    await t.test('dual-view.js click handler passes silent=true to navigation and hides UI', () => {
        let prevCalledWith = null;
        let nextCalledWith = null;
        let isRtl = false;
        let hideUICalled = false;

        const mockHideUI = () => { hideUICalled = true; };
        const mockPrev = (step, silent) => { prevCalledWith = { step, silent }; };
        const mockNext = (step, silent) => { nextCalledWith = { step, silent }; };

        function simulateClickHandler(e, width = 1000) {
            if (mockHideUI) mockHideUI();
            if (e.clientX > width / 2) {
                isRtl ? mockPrev(undefined, true) : mockNext(undefined, true);
            } else {
                isRtl ? mockNext(undefined, true) : mockPrev(undefined, true);
            }
        }

        simulateClickHandler({ clientX: 800 }); // click right side -> next in LTR
        assert.strictEqual(hideUICalled, true);
        assert.deepStrictEqual(nextCalledWith, { step: undefined, silent: true });

        hideUICalled = false;
        simulateClickHandler({ clientX: 200 }); // click left side -> prev in LTR
        assert.strictEqual(hideUICalled, true);
        assert.deepStrictEqual(prevCalledWith, { step: undefined, silent: true });
    });

    if (activityTimeout) clearTimeout(activityTimeout);
});
