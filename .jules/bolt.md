## 2024-05-19 - Synchronous File I/O in Hot Paths
**Learning:** `fs.readFileSync` inside high-frequency endpoints (like `/image` which runs per image chunk) causes severe event loop blocking, especially since it forces the server to re-parse the file contents (e.g. CSV) on every request.
**Action:** Use an in-memory cache tied to the file's `mtimeMs` via `fs.statSync` (or an async equivalent) to check for modifications cheaply and avoid redundant reading and parsing.
## 2024-05-19 - Layout Thrashing inside requestAnimationFrame
**Learning:** Placing DOM reads (`scrollHeight`, `scrollY`) after a DOM write (`scrollBy`) inside a high-frequency `requestAnimationFrame` loop forces the browser to synchronously recalculate layout on every frame, entirely defeating the purpose of requestAnimationFrame and causing severe jank.
**Action:** Always batch DOM reads before DOM writes, even when code is already wrapped in `requestAnimationFrame`.
## 2024-05-19 - O(N) Array Operations in Hot Endpoints
**Learning:** Performing O(N) array scans (`Array.prototype.some`) combined with synchronous operations like `path.resolve` inside frequently called API endpoints (e.g., `/image`) causes significant event loop lag and degrades server throughput.
**Action:** Pre-calculate the necessary values during cache validation (e.g., resolving bookmark paths) and store them in a `Set` to enable O(1) lookups during the request cycle.
## 2024-05-19 - Expensive System Calls in Hot Loops
**Learning:** `path.resolve` requires evaluating the current working directory (`process.cwd()`) and doing complex string manipulations. Calling this repeatedly inside tight loops or high-frequency endpoints (like checking allowed directories for every chunk in the `/image` stream) causes measurable CPU overhead and degrades server throughput.
**Action:** Wrap `path.resolve` inside a cache (`Map`) for frequently evaluated paths.
