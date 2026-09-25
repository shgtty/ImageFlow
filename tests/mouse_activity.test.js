const test = require('node:test');
const assert = require('node:assert');

test('Mouse activity threshold and sensitivity logic', async (t) => {
    let activityTimeout = null;
    let lastActivityReset = 0;
    let mouseActivityThreshold = 60;
    let lastActivityMouseX = null;
    let lastActivityMouseY = null;
    let lastMouseX = 100;
    let lastMouseY = 100;
    let mouseStopTimer = null;
    const MOUSE_STOP_DELAY = 50; // Shortened for tests

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

    function hideUI() {
        if (activityTimeout) {
            clearTimeout(activityTimeout);
            activityTimeout = null;
        }
        if (mouseStopTimer) {
            clearTimeout(mouseStopTimer);
            mouseStopTimer = null;
        }
        fabContainer.classList.add('hidden');
        documentElement.classList.add('hide-cursor');
        lastActivityReset = 0;
        if (typeof lastMouseX === 'number' && typeof lastMouseY === 'number' && (lastMouseX !== 0 || lastMouseY !== 0)) {
            lastActivityMouseX = lastMouseX;
            lastActivityMouseY = lastMouseY;
        }
    }

    function resetActivityTimer() {
        const now = Date.now();
        if (now - lastActivityReset < 250) return;
        lastActivityReset = now;

        if (typeof lastMouseX === 'number' && typeof lastMouseY === 'number' && (lastMouseX !== 0 || lastMouseY !== 0)) {
            lastActivityMouseX = lastMouseX;
            lastActivityMouseY = lastMouseY;
        }

        fabContainer.classList.remove('hidden');
        documentElement.classList.remove('hide-cursor');

        if (activityTimeout) clearTimeout(activityTimeout);
        activityTimeout = setTimeout(hideUI, 3000);
    }

    function handleMouseMoveActivity(e) {
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;

        if (lastActivityMouseX === null || lastActivityMouseY === null) {
            lastActivityMouseX = e.clientX;
            lastActivityMouseY = e.clientY;
            return;
        }

        const dx = e.clientX - lastActivityMouseX;
        const dy = e.clientY - lastActivityMouseY;
        const dist = Math.hypot(dx, dy);

        if (dist >= mouseActivityThreshold) {
            if (mouseStopTimer) {
                clearTimeout(mouseStopTimer);
                mouseStopTimer = null;
            }
            lastActivityMouseX = e.clientX;
            lastActivityMouseY = e.clientY;
            resetActivityTimer();
        } else {
            if (mouseStopTimer) clearTimeout(mouseStopTimer);
            mouseStopTimer = setTimeout(() => {
                lastActivityMouseX = lastMouseX;
                lastActivityMouseY = lastMouseY;
                mouseStopTimer = null;
            }, MOUSE_STOP_DELAY);
        }
    }

    function handlePointerDown(e) {
        if (mouseStopTimer) {
            clearTimeout(mouseStopTimer);
            mouseStopTimer = null;
        }
        const touch = e.touches && e.touches[0];
        const clientX = touch ? touch.clientX : e.clientX;
        const clientY = touch ? touch.clientY : e.clientY;
        if (clientX !== undefined && clientY !== undefined) {
            lastActivityMouseX = clientX;
            lastActivityMouseY = clientY;
            lastMouseX = clientX;
            lastMouseY = clientY;
        }
        resetActivityTimer();
    }

    await t.test('ignores slight movements (< 60px) when UI is hidden', () => {
        lastMouseX = 100;
        lastMouseY = 100;
        lastActivityMouseX = 100;
        lastActivityMouseY = 100;
        hideUI();
        assert.strictEqual(fabContainer.classList.contains('hidden'), true);
        assert.strictEqual(documentElement.classList.contains('hide-cursor'), true);
        assert.strictEqual(lastActivityMouseX, 100);
        assert.strictEqual(lastActivityMouseY, 100);

        // Move 10px right (slight movement / desk bump)
        handleMouseMoveActivity({ clientX: 110, clientY: 100 });
        assert.strictEqual(fabContainer.classList.contains('hidden'), true, 'UI should remain hidden for 10px movement');

        // Move 30px down
        handleMouseMoveActivity({ clientX: 110, clientY: 130 });
        assert.strictEqual(fabContainer.classList.contains('hidden'), true, 'UI should remain hidden for 30px movement');

        // Move 40px away
        handleMouseMoveActivity({ clientX: 130, clientY: 130 });
        assert.strictEqual(fabContainer.classList.contains('hidden'), true, 'UI should remain hidden for 42px movement');
    });

    await t.test('wakes up UI when mouse moves >= 60px from anchor', () => {
        lastMouseX = 100;
        lastMouseY = 100;
        lastActivityMouseX = 100;
        lastActivityMouseY = 100;
        hideUI();
        assert.strictEqual(fabContainer.classList.contains('hidden'), true);

        // Move 40px to the right from anchor (100, 100) -> distance = 40 < 60
        handleMouseMoveActivity({ clientX: 140, clientY: 100 });
        assert.strictEqual(fabContainer.classList.contains('hidden'), true);

        // Move to (170, 100) -> 70px from anchor (100, 100) -> distance = 70 >= 60
        handleMouseMoveActivity({ clientX: 170, clientY: 100 });
        assert.strictEqual(fabContainer.classList.contains('hidden'), false, 'UI should wake up when distance >= 60px');
        assert.strictEqual(documentElement.classList.contains('hide-cursor'), false, 'Cursor should be visible');
        assert.strictEqual(lastActivityMouseX, 170, 'Anchor should update to new position');
    });

    await t.test('stopping the mouse resets the count so small movements across pauses do not accumulate', async () => {
        lastMouseX = 100;
        lastMouseY = 100;
        lastActivityMouseX = 100;
        lastActivityMouseY = 100;
        hideUI();
        assert.strictEqual(fabContainer.classList.contains('hidden'), true);

        // First small nudge: 30px right
        handleMouseMoveActivity({ clientX: 130, clientY: 100 });
        assert.strictEqual(fabContainer.classList.contains('hidden'), true);
        assert.strictEqual(lastActivityMouseX, 100);

        // Stop mouse (wait for MOUSE_STOP_DELAY = 50ms)
        await new Promise(r => setTimeout(r, 60));

        // After stopping, anchor must be reset to the stopped position (130, 100)
        assert.strictEqual(lastActivityMouseX, 130, 'Anchor should reset to current position after stopping');
        assert.strictEqual(lastActivityMouseY, 100);

        // Second small nudge: another 30px right to (160, 100)
        handleMouseMoveActivity({ clientX: 160, clientY: 100 });
        // Because count was reset upon stopping, distance is |160 - 130| = 30px < 60px!
        // (Without reset, distance would have been |160 - 100| = 60px and triggered)
        assert.strictEqual(fabContainer.classList.contains('hidden'), true, 'UI should remain hidden because previous movement was reset on stop');

        // Stop mouse again
        await new Promise(r => setTimeout(r, 60));
        assert.strictEqual(lastActivityMouseX, 160);

        // Now move 70px in one continuous motion to (230, 100)
        handleMouseMoveActivity({ clientX: 230, clientY: 100 });
        assert.strictEqual(fabContainer.classList.contains('hidden'), false, 'Continuous 70px motion should trigger UI');
    });

    await t.test('configurable threshold allows custom sensitivity', () => {
        lastMouseX = 100;
        lastMouseY = 100;
        lastActivityMouseX = 100;
        lastActivityMouseY = 100;
        hideUI();

        // Change threshold to 120px
        mouseActivityThreshold = 120;

        // Move 80px -> should still be ignored
        handleMouseMoveActivity({ clientX: 180, clientY: 100 });
        assert.strictEqual(fabContainer.classList.contains('hidden'), true);

        // Move 130px -> triggers UI
        handleMouseMoveActivity({ clientX: 230, clientY: 100 });
        assert.strictEqual(fabContainer.classList.contains('hidden'), false);

        // Restore default
        mouseActivityThreshold = 60;
    });

    await t.test('mousedown or touchstart immediately resets timer regardless of position', () => {
        hideUI();
        assert.strictEqual(fabContainer.classList.contains('hidden'), true);

        // Click at same position (0 distance)
        handlePointerDown({ clientX: 100, clientY: 100 });
        assert.strictEqual(fabContainer.classList.contains('hidden'), false, 'Click should immediately show UI');

        hideUI();
        assert.strictEqual(fabContainer.classList.contains('hidden'), true);

        // Touch at same position
        handlePointerDown({ touches: [{ clientX: 100, clientY: 100 }] });
        assert.strictEqual(fabContainer.classList.contains('hidden'), false, 'Touch should immediately show UI');
    });

    if (activityTimeout) clearTimeout(activityTimeout);
    if (mouseStopTimer) clearTimeout(mouseStopTimer);
});
