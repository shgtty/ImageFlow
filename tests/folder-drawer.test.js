const test = require('node:test');
const assert = require('node:assert');
const utils = require('../public/js/utils.js');
global.getFolderPath = utils.getFolderPath;
global.getFolderDisplayName = utils.getFolderDisplayName;
global.isVideoUrl = utils.isVideoUrl;

const FolderDrawer = require('../public/js/folder-drawer.js');

test('FolderDrawer.extractFolders', async (t) => {
    await t.test('returns empty array when imageUrls is empty or null', () => {
        assert.deepStrictEqual(FolderDrawer.extractFolders([]), []);
        assert.deepStrictEqual(FolderDrawer.extractFolders(null), []);
    });

    await t.test('groups normal directory images and calculates count and first image', () => {
        const imageUrls = [
            '/image?path=C%3A%5CPhotos%5CVacation%5Cphoto1.jpg',
            '/image?path=C%3A%5CPhotos%5CVacation%5Cphoto2.jpg',
            '/image?path=C%3A%5CPhotos%5CVacation%5Cphoto3.jpg',
            '/image?path=C%3A%5CPhotos%5CFamily%5Cpic1.png'
        ];

        const folders = FolderDrawer.extractFolders(imageUrls);
        assert.strictEqual(folders.length, 2);

        // Vacation folder
        const vacation = folders.find(f => f.displayName === 'Vacation');
        assert.ok(vacation);
        assert.strictEqual(vacation.count, 3);
        assert.strictEqual(vacation.firstImageUrl, imageUrls[0]);
        assert.strictEqual(vacation.firstIndex, 0);
        assert.strictEqual(vacation.isZip, false);

        // Family folder
        const family = folders.find(f => f.displayName === 'Family');
        assert.ok(family);
        assert.strictEqual(family.count, 1);
        assert.strictEqual(family.firstImageUrl, imageUrls[3]);
        assert.strictEqual(family.firstIndex, 3);
        assert.strictEqual(family.isZip, false);
    });

    await t.test('correctly handles ZIP files and ZIP subfolders', () => {
        const imageUrls = [
            '/image?path=C%3A%5CArchives%5CArchive.zip%7Cphoto1.jpg',
            '/image?path=C%3A%5CArchives%5CArchive.zip%7Cphoto2.jpg',
            '/image?path=C%3A%5CArchives%5CArchive.zip%7Csubfolder%2Fimg1.png',
            '/image?path=C%3A%5CArchives%5CArchive.zip%7Csubfolder%2Fimg2.png'
        ];

        const folders = FolderDrawer.extractFolders(imageUrls);
        assert.strictEqual(folders.length, 2);

        // ZIP root
        const zipRoot = folders.find(f => f.displayName === 'Archive.zip');
        assert.ok(zipRoot);
        assert.strictEqual(zipRoot.count, 2);
        assert.strictEqual(zipRoot.isZip, true);
        assert.strictEqual(zipRoot.firstIndex, 0);

        // ZIP subfolder
        const zipSub = folders.find(f => f.displayName.includes('subfolder'));
        assert.ok(zipSub);
        assert.strictEqual(zipSub.count, 2);
        assert.strictEqual(zipSub.isZip, true);
        assert.strictEqual(zipSub.firstIndex, 2);
    });
});
