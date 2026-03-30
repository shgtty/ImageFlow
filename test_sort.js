const allImagesUrls = [
    '/image?path=C%3A%5CPhotos%5Cbbb%5C1.jpg',
    '/image?path=C%3A%5CPhotos%5CAAA%5C3.jpg',
    '/image?path=C%3A%5CPhotos%5Cccc%5C1.jpg',
    '/image?path=C%3A%5CPhotos%5Caaa%5C1.jpg',
];

// This is how server.js sorts
allImagesUrls.sort((a, b) => a.localeCompare(b));

console.log(allImagesUrls);
