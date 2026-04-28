## 2024-05-25 - [Filter Keyword Delete Buttons Accessibility Fix]
**Learning:** In the filter modal, the `×` icons were initially implemented as `<span>` tags with `onclick` handlers, creating a keyboard trap that blocked screen readers and keyboard users from deleting filters.
**Action:** Always use semantic `<button type="button">` with custom `aria-label`s for dynamically injected UI actions. Apply `background: transparent; border: none;` to reset visual styles while maintaining full accessibility benefits.

## 2024-05-25 - [Async Button Loading State Accessibility]
**Learning:** During asynchronous API calls for the "save filter" and "save config" operations, the UI lacked visual feedback and state management. This allowed users to accidentally double-click the button, triggering multiple requests and causing confusion.
**Action:** Always disable buttons triggering async operations immediately, and provide visual feedback (e.g., changing text to '保存中...' or adding a spinner). Use a `.finally()` block in the Promise chain to guarantee the button state and original text are reliably restored, regardless of success or error.
