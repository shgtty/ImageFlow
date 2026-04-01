## 2024-05-19 - Avoid redundant toLowerCase() in loops
**Learning:** O(N * M) string operations, such as calling `.toLowerCase()` inside a nested array iteration (`filter` followed by `every`/`some`), can significantly slow down backend APIs dealing with large numbers of elements (like scanning thousands of image files).
**Action:** When iterating over a large array and comparing against a smaller list of strings, always pre-calculate lowercased versions of the smaller list before entering the loop to ensure O(N + M) complexity for string casing instead of O(N * M).
## 2024-05-20 - Prevent layout thrashing in masonry rendering
**Learning:** Interleaving DOM reads (`offsetWidth`) and DOM writes (`appendChild`) inside a loop forces the browser to synchronously recalculate layout on every iteration, causing severe layout thrashing and blocking the main thread during batch image rendering in a masonry layout.
**Action:** When calculating elements' positions/dimensions for DOM insertion, always batch DOM reads by calculating and caching dimensions (like column widths) *before* entering the loop that performs DOM writes (`appendChild`).
