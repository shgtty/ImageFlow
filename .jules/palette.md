## 2024-05-25 - [Filter Keyword Delete Buttons Accessibility Fix]
**Learning:** In the filter modal, the `×` icons were initially implemented as `<span>` tags with `onclick` handlers, creating a keyboard trap that blocked screen readers and keyboard users from deleting filters.
**Action:** Always use semantic `<button type="button">` with custom `aria-label`s for dynamically injected UI actions. Apply `background: transparent; border: none;` to reset visual styles while maintaining full accessibility benefits.
