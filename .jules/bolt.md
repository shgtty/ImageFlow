## 2024-05-19 - Avoid redundant toLowerCase() in loops
**Learning:** O(N * M) string operations, such as calling `.toLowerCase()` inside a nested array iteration (`filter` followed by `every`/`some`), can significantly slow down backend APIs dealing with large numbers of elements (like scanning thousands of image files).
**Action:** When iterating over a large array and comparing against a smaller list of strings, always pre-calculate lowercased versions of the smaller list before entering the loop to ensure O(N + M) complexity for string casing instead of O(N * M).
## 2024-05-19 - Avoid layout thrashing in loops
**Learning:** Interleaving DOM reads (`offsetWidth`, `getBoundingClientRect`, etc.) and DOM writes (`appendChild`, `style.xxx`) inside a loop forces the browser to recalculate layout (reflow) on every iteration. This causes severe main thread blocking and jank (Layout Thrashing), particularly when rendering many elements at once, like a batch of images in a masonry layout.
**Action:** Always batch DOM reads and writes. Calculate dimensions (like column widths) *outside* the loop before making DOM modifications, or use `requestAnimationFrame` to schedule reads/writes properly.
## 2024-05-19 - Avoid redundant fs.statSync loops with withFileTypes
**Learning:** Using `fs.readdirSync` simply returns string file names. Using it inside a recursive crawler means making another `fs.statSync` system call on every single file just to check if it's a directory or a file. This generates significant blocking overhead on large directories.
**Action:** Use `fs.readdirSync(path, { withFileTypes: true })` instead. This returns an array of `fs.Dirent` objects which immediately let you check `.isDirectory()` and `.isFile()` without extra system calls. *Crucially*, `Dirent` objects that are symlinks return `false` for both, so you must explicitly check `.isSymbolicLink()` and fallback to `fs.statSync` to maintain expected symlink resolution behaviors.
## 2024-05-19 - Throttle expensive elementFromPoint queries on mousemove
**Learning:** High-frequency event listeners like `mousemove` can fire 125-1000 times per second. Synchronously performing expensive operations like `document.elementFromPoint()` (which forces a hit-test and layout recalculation) on every event blocks the main thread and causes severe UI jank.
**Action:** Always throttle or debounce expensive DOM queries inside high-frequency event listeners. Using `requestAnimationFrame` bounds the processing cost to the display refresh rate (e.g., 60Hz), making the application much smoother.
## 2024-05-19 - Skip string operations when filters are empty
**Learning:** In backend routes processing large arrays (e.g., thousands of image paths), executing `toLowerCase()` and evaluating string matches inside a loop when no filter configuration is provided by the user generates massive, unnecessary garbage collection overhead and string allocation.
**Action:** Always implement a fast-path that checks if filter arrays are empty before entering O(N) iteration loops over large datasets. Bypassing the loop entirely ensures optimal performance for the default/unfiltered use-case.
## 2024-05-19 - Avoid layout thrashing inside scroll and mousemove event listeners
**Learning:** Synchronous DOM reads (like `scrollHeight`, `scrollY`, or `getBoundingClientRect()`) inside high-frequency event listeners (`scroll`, `mousemove`) cause the browser to perform expensive hit-testing and synchronous layout recalculations, severely blocking the main thread and resulting in UI jank.
**Action:** Always throttle these expensive synchronous DOM reads using `requestAnimationFrame`. This bounds the processing to the display refresh rate and prevents layout thrashing during continuous scrolling or mouse movement.

## 2024-05-19 - Avoid synchronous file reads inside request handlers
**Learning:** Performing synchronous file operations like `fs.readFileSync` inside high-frequency request routes (such as serving thousands of images via a `/image` endpoint or an `/api/images` data fetch) completely blocks the Node.js event loop for all users.
**Action:** Always cache file contents in memory at startup. For configuration files that might change, use `fs.watch` to asynchronously update the memory cache instead of reading from disk on every request.
## 2024-05-19 - Avoid new URL() parsing in tight loops
**Learning:** Using the native `new URL()` constructor to parse search parameters is computationally expensive (approx. 3-4x slower than basic string methods). When executed in tight loops over large datasets (like iterating through thousands of image URLs to determine folder groupings), this overhead blocks the main thread and causes UI jank.
**Action:** When extracting simple known parameters (like `?path=`) from thousands of strings during rendering or sorting, use fast string parsing (`indexOf`, `substring`) as a primary optimization path, falling back to `new URL()` only for complex edge cases.

## 2024-06-25 - Avoid synchronous fs operations inside streaming request handlers
**Learning:** Performing a synchronous file operation like `fs.existsSync` inside high-frequency endpoints (like `/image` which can be called hundreds of times per second) blocks the Node.js main event loop for all concurrent users (TOCTOU anti-pattern).
**Action:** Use asynchronous stream events (like `.on('error')`) to handle missing files or access errors when streaming static assets using `fs.createReadStream`, rather than blocking to check existence beforehand.
## 2026-04-10 - Throttle wheel events for discrete navigation
**Learning:** High-frequency `wheel` events (e.g. from trackpads or free-scrolling mice) can trigger dozens of times per second. If these events are directly bound to discrete navigation functions (like `next()` or `prev()`) that also trigger network requests (e.g., fetching image dimensions via `getImageDims`), it causes severe UI skipping, layout thrashing, and floods the browser's connection queue.
**Action:** Always add time-based throttling (e.g., 250ms) to `wheel` event listeners when they are used to trigger discrete, network-bound navigation state changes.
## 2024-08-01 - Avoid redundant O(N) array scans during rapid UI updates
**Learning:** Functions like `getFolderBounds` that scan an entire array (O(N) complexity) to find boundary limits can cause massive UI jank if they are attached to high-frequency events like `mousemove` (e.g. updating a seekbar's tooltip). While the array scan itself might be fast, repeated calls involving string manipulation or parsing quickly add up to block the main thread.
**Action:** When a boundary or range calculation doesn't change unless the underlying data array changes, implement a scoped cache that remembers the start, end, and total for a given item index. Invalidate the cache when the array reference changes.
## 2024-05-19 - Avoid using localeCompare inside array sort callbacks for massive arrays
**Learning:** `String.prototype.localeCompare` is extremely slow in Node.js/V8 when used inside `.sort()` on large arrays (e.g. 50,000+ strings), because it instantiates a new collator object and performs complex linguistic comparisons on every single iteration.
**Action:** Always pre-instantiate an `Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })` outside the sort loop and pass its `.compare` method directly to `Array.prototype.sort()`. This preserves natural/alphanumeric sorting capabilities while running 10x-20x faster.
