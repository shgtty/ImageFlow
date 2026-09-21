const test = require('node:test');
const assert = require('node:assert');
const utils = require('../public/js/utils.js');

test('Cursor Tooltip Update logic', async (t) => {
    // Mock environment
    let lastMouseX = 100;
    let lastMouseY = 100;
    let enableCursorTooltip = true;
    let hoveredImageElement = null;

    const cursorTooltip = {
        style: { opacity: '0', left: '0px', top: '0px', transform: '' },
        dataset: { currentSrc: '', tipWidth: 0, tipHeight: 0 },
        textContent: '',
        offsetWidth: 120,
        offsetHeight: 30
    };

    let elementAtPoint = null;

    const mockDocument = {
        documentElement: {
            classList: {
                contains: () => false
            }
        },
        elementFromPoint: (x, y) => elementAtPoint
    };

    function getMediaElementUnderMouse() {
        if (lastMouseX <= 0 && lastMouseY <= 0) return null;
        const el = mockDocument.elementFromPoint(lastMouseX, lastMouseY);
        if (!el) return null;

        if (el.closest && el.closest('.fab, #seekbar-container, #folder-drawer, #drawer-hover-trigger, .modal')) {
            return null;
        }

        if (el.tagName === 'IMG' || el.tagName === 'VIDEO') {
            return el;
        }

        const wrapper = el.closest ? el.closest('.image-wrapper') : null;
        if (wrapper) {
            return wrapper.querySelector('img, video');
        }

        return null;
    }

    function updateCursorTooltipContent(forceRefresh = false) {
        if (!enableCursorTooltip || !cursorTooltip) return;

        if (mockDocument.documentElement.classList.contains('hide-cursor')) {
            cursorTooltip.style.opacity = '0';
            return;
        }

        if (forceRefresh || !hoveredImageElement || !hoveredImageElement.isConnected) {
            hoveredImageElement = getMediaElementUnderMouse();
        }

        const target = hoveredImageElement;
        if (target && (target.tagName === 'IMG' || target.tagName === 'VIDEO') && target.isConnected) {
            const currentSrc = target.currentSrc || target.src;
            let filename = '';

            let tipWidth = 0;
            let tipHeight = 0;

            if (forceRefresh || cursorTooltip.dataset.currentSrc !== currentSrc) {
                filename = utils.getFilename(currentSrc);
                const foldername = utils.getFolderDisplayName(currentSrc);
                if (filename) {
                    cursorTooltip.textContent = foldername ? `${foldername} > ${filename}` : filename;
                    cursorTooltip.dataset.currentSrc = currentSrc;

                    tipWidth = cursorTooltip.offsetWidth;
                    tipHeight = cursorTooltip.offsetHeight;
                    cursorTooltip.dataset.tipWidth = tipWidth;
                    cursorTooltip.dataset.tipHeight = tipHeight;
                } else {
                    cursorTooltip.style.opacity = '0';
                    cursorTooltip.dataset.currentSrc = '';
                    return;
                }
            } else if (currentSrc) {
                filename = 'valid';
                tipWidth = parseInt(cursorTooltip.dataset.tipWidth) || 0;
                tipHeight = parseInt(cursorTooltip.dataset.tipHeight) || 0;
            }

            if (filename) {
                cursorTooltip.style.left = `${lastMouseX}px`;
                cursorTooltip.style.top = `${lastMouseY}px`;
                cursorTooltip.style.opacity = '1';
            } else {
                cursorTooltip.style.opacity = '0';
                cursorTooltip.dataset.currentSrc = '';
            }
        } else {
            cursorTooltip.style.opacity = '0';
            cursorTooltip.dataset.currentSrc = '';
        }
    }

    await t.test('updates tooltip to new image when view switches and element is under cursor', () => {
        // Initially in Gallery View over Image 1
        const img1 = {
            tagName: 'IMG',
            src: '/image?path=C%3A%5CPhotos%5CGallery%5Cimage1.jpg',
            isConnected: true
        };
        elementAtPoint = img1;
        hoveredImageElement = img1;

        updateCursorTooltipContent();
        assert.strictEqual(cursorTooltip.textContent, 'Gallery > image1.jpg');
        assert.strictEqual(cursorTooltip.style.opacity, '1');

        // Switch to Dual View:
        // img1 is removed from DOM (isConnected = false)
        img1.isConnected = false;

        // Dual View renders img2 at the same cursor point
        const img2 = {
            tagName: 'IMG',
            src: '/image?path=C%3A%5CPhotos%5CDual%5Cimage2.jpg',
            isConnected: true
        };
        elementAtPoint = img2;

        // Force refresh called on render
        updateCursorTooltipContent(true);
        assert.strictEqual(cursorTooltip.textContent, 'Dual > image2.jpg');
        assert.strictEqual(cursorTooltip.style.opacity, '1');
        assert.strictEqual(cursorTooltip.dataset.currentSrc, img2.src);
    });

    await t.test('hides tooltip when switched view has empty space/background under cursor', () => {
        // Dual view has black bar / no image under (100, 100)
        elementAtPoint = {
            tagName: 'DIV',
            className: 'cell',
            isConnected: true,
            closest: () => null
        };

        updateCursorTooltipContent(true);
        assert.strictEqual(cursorTooltip.style.opacity, '0');
        assert.strictEqual(cursorTooltip.dataset.currentSrc, '');
    });

    await t.test('supports video elements under cursor', () => {
        const videoEl = {
            tagName: 'VIDEO',
            src: '/image?path=C%3A%5CVideos%5Cclip.mp4',
            isConnected: true
        };
        elementAtPoint = videoEl;

        updateCursorTooltipContent(true);
        assert.strictEqual(cursorTooltip.textContent, 'Videos > clip.mp4');
        assert.strictEqual(cursorTooltip.style.opacity, '1');
    });

    await t.test('detects media inside image-wrapper when hovering wrapper child (like bookmark button)', () => {
        const innerImg = {
            tagName: 'IMG',
            src: '/image?path=C%3A%5CPhotos%5Cnested.jpg',
            isConnected: true
        };
        const wrapper = {
            className: 'image-wrapper',
            querySelector: (sel) => innerImg
        };
        const bookmarkBtn = {
            tagName: 'BUTTON',
            className: 'bookmark-star-btn',
            isConnected: true,
            closest: (sel) => {
                if (sel.includes('.image-wrapper')) return wrapper;
                return null;
            }
        };
        elementAtPoint = bookmarkBtn;

        updateCursorTooltipContent(true);
        assert.strictEqual(cursorTooltip.textContent, 'Photos > nested.jpg');
        assert.strictEqual(cursorTooltip.style.opacity, '1');
    });
});
