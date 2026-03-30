const { getFolderPath } = require('./public/js/utils.js');

const allImagesUrls = [
    '/image?path=C%3A%5CPhotos%5CAAA%5C1.jpg', // 0
    '/image?path=C%3A%5CPhotos%5CAAA%5C2.jpg', // 1
    '/image?path=C%3A%5CPhotos%5CAAA%5C3.jpg', // 2
    '/image?path=C%3A%5CPhotos%5CBBB%5C1.jpg', // 3
    '/image?path=C%3A%5CPhotos%5CBBB%5C2.jpg', // 4
    '/image?path=C%3A%5CPhotos%5CBBB%5C3.jpg', // 5
    '/image?path=C%3A%5CPhotos%5CCCC%5C1.jpg', // 6
    '/image?path=C%3A%5CPhotos%5CCCC%5C2.jpg', // 7
];

function testSkip(currentIndex, direction) {
    const currentFolder = getFolderPath(allImagesUrls[currentIndex], 'http://localhost');
    let targetIndex = currentIndex;

    if (direction > 0) {
        for (let i = currentIndex + 1; i < allImagesUrls.length; i++) {
            if (getFolderPath(allImagesUrls[i], 'http://localhost') !== currentFolder) {
                targetIndex = i;
                break;
            }
        }
        if (targetIndex === currentIndex) targetIndex = 0;
    } else {
        let startOfCurrent = currentIndex;
        while (startOfCurrent > 0 && getFolderPath(allImagesUrls[startOfCurrent - 1], 'http://localhost') === currentFolder) {
            startOfCurrent--;
        }

        if (currentIndex > startOfCurrent) {
            targetIndex = startOfCurrent;
        } else {
            if (startOfCurrent > 0) {
                const prevFolder = getFolderPath(allImagesUrls[startOfCurrent - 1], 'http://localhost');
                targetIndex = startOfCurrent - 1;
                while (targetIndex > 0 && getFolderPath(allImagesUrls[targetIndex - 1], 'http://localhost') === prevFolder) {
                    targetIndex--;
                }
            } else {
                const lastFolder = getFolderPath(allImagesUrls[allImagesUrls.length - 1], 'http://localhost');
                targetIndex = allImagesUrls.length - 1;
                while (targetIndex > 0 && getFolderPath(allImagesUrls[targetIndex - 1], 'http://localhost') === lastFolder) {
                    targetIndex--;
                }
            }
        }
    }
    return targetIndex;
}

console.log('Current: 0 (AAA), PageDown ->', testSkip(0, 1)); // Expected 3 (BBB)
console.log('Current: 1 (AAA), PageDown ->', testSkip(1, 1)); // Expected 3 (BBB)
console.log('Current: 4 (BBB), PageDown ->', testSkip(4, 1)); // Expected 6 (CCC)
console.log('Current: 7 (CCC), PageDown ->', testSkip(7, 1)); // Expected 0 (wrap to start)

console.log('Current: 1 (AAA), PageUp ->', testSkip(1, -1)); // Expected 0 (start of AAA)
console.log('Current: 0 (AAA), PageUp ->', testSkip(0, -1)); // Expected 6 (wrap to CCC)
console.log('Current: 4 (BBB), PageUp ->', testSkip(4, -1)); // Expected 3 (start of BBB)
console.log('Current: 3 (BBB), PageUp ->', testSkip(3, -1)); // Expected 0 (start of AAA)
console.log('Current: 7 (CCC), PageUp ->', testSkip(7, -1)); // Expected 6 (start of CCC)
console.log('Current: 6 (CCC), PageUp ->', testSkip(6, -1)); // Expected 3 (start of BBB)
