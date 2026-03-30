const fs = require('fs');

let code = fs.readFileSync('public/js/gallery-view.js', 'utf8');

// There is a bug in the code I just inserted:
// pendingImages--; nextToPlace++; are inside the if(!currentObj.error) or inside the while loop?
// They should be inside the while loop.
// Wait, pendingImages--; should happen for both error and non-error, because we added `pendingImages += (max - currentIndex);` at the start.
// Yes, the code is:
// if (!currentObj.error) { ... }
// pendingImages--;
// nextToPlace++;
// This is correct.

// Let's verify `batchImages` is correctly scoped.
// `nextToPlace` is local to `renderNextBatch`. `processBatchQueue` is inside `renderNextBatch`. This is correct.
// However, `batchImages.push(obj)` must happen before `img.src` is set, which it does.
// Because if `img.src` is cached, `onload` can fire synchronously.
// But wait! If `onload` fires synchronously, `batchImages.push(obj)` will have already been called because it's BEFORE `img.src`.
// BUT, if `processBatchQueue` is called synchronously, `nextToPlace < totalInBatch` is evaluated. `totalInBatch` is `max - currentIndex`.
// If `onload` fires synchronously on the first image, `totalInBatch` is evaluated correctly, `nextToPlace` is 0, `batchImages[0]` is checked.
// Yes, `batchImages` has 1 item. `nextToPlace` is 0. So it processes it.
// This is correct!

console.log("Looks correct.");
