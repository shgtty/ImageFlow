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
