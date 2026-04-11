function getFolderBounds(globalIndex, allImagesUrls) {
    if (!allImagesUrls || allImagesUrls.length === 0 || globalIndex < 0 || globalIndex >= allImagesUrls.length) return { start: 0, end: 0, total: 0, relativeIndex: 0 };

    // Check cache
    if (getFolderBounds.cache &&
        globalIndex >= getFolderBounds.cache.start &&
        globalIndex <= getFolderBounds.cache.end &&
        getFolderBounds.cache.urls === allImagesUrls) {
        return {
            start: getFolderBounds.cache.start,
            end: getFolderBounds.cache.end,
            total: getFolderBounds.cache.total,
            relativeIndex: globalIndex - getFolderBounds.cache.start
        };
    }

    const currentFolder = getFolderPath(allImagesUrls[globalIndex]);
    let start = globalIndex;
    while (start > 0 && getFolderPath(allImagesUrls[start - 1]) === currentFolder) { start--; }
    let end = globalIndex;
    while (end + 1 < allImagesUrls.length && getFolderPath(allImagesUrls[end + 1]) === currentFolder) { end++; }

    const bounds = { start, end, total: end - start + 1, relativeIndex: globalIndex - start };

    // Update cache
    getFolderBounds.cache = {
        start: bounds.start,
        end: bounds.end,
        total: bounds.total,
        urls: allImagesUrls
    };

    return bounds;
}
