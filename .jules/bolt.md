## 2024-05-19 - Synchronous File I/O in Hot Paths
**Learning:** `fs.readFileSync` inside high-frequency endpoints (like `/image` which runs per image chunk) causes severe event loop blocking, especially since it forces the server to re-parse the file contents (e.g. CSV) on every request.
**Action:** Use an in-memory cache tied to the file's `mtimeMs` via `fs.statSync` (or an async equivalent) to check for modifications cheaply and avoid redundant reading and parsing.
