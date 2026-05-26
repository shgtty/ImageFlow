## 2024-05-25 - [Filter Keyword Delete Buttons Accessibility Fix]
**Learning:** In the filter modal, the `×` icons were initially implemented as `<span>` tags with `onclick` handlers, creating a keyboard trap that blocked screen readers and keyboard users from deleting filters.
**Action:** Always use semantic `<button type="button">` with custom `aria-label`s for dynamically injected UI actions. Apply `background: transparent; border: none;` to reset visual styles while maintaining full accessibility benefits.

## 2024-05-25 - [Async Button Loading State Accessibility]
**Learning:** During asynchronous API calls for the "save filter" and "save config" operations, the UI lacked visual feedback and state management. This allowed users to accidentally double-click the button, triggering multiple requests and causing confusion.
**Action:** Always disable buttons triggering async operations immediately, and provide visual feedback (e.g., changing text to '保存中...' or adding a spinner). Use a `.finally()` block in the Promise chain to guarantee the button state and original text are reliably restored, regardless of success or error.

## 2024-05-25 - [Accessible Interactive List Items]
**Learning:** In the file select modal, `.file-item` elements were implemented as `<div>` elements with click handlers but no keyboard support, role, or focus styles. Since they also contained a nested edit `<button>`, changing the parent element to a `<button>` would create invalid HTML (nested interactive elements).
**Action:** Always build accessible interactive list items with nested actions using a parent `<div>` with `role="button"` and `tabindex="0"`, attach manual `keydown` handlers for Enter/Space, apply custom `:focus-visible` styles, and give nested action buttons contextual `aria-label`s.

## 2024-05-25 - [Accessible Modal Forms and Textareas]
**Learning:** In custom modals (`[role="dialog"]`), text inputs and textareas used for filtering or editing raw configuration data lacked `aria-label`s, making their purpose ambiguous to screen readers. Additionally, while `button` and `input` elements had explicit `:focus-visible` styles, `textarea` was overlooked, causing it to disappear during keyboard navigation.
**Action:** Always provide contextual `aria-label`s for inputs that lack explicit `<label>` elements. Ensure that global `:focus-visible` CSS resets or custom implementations within modals explicitly cover all interactive text inputs, including `textarea` elements.

## 2026-05-26 - [Hidden Interactive Elements Keyboard Accessibility]
**Learning:** In the image gallery, dynamically injected bookmark buttons (`.bookmark-star-btn`) were hidden by default using `opacity: 0` and only shown on `:hover`. This made the buttons completely invisible and inaccessible to keyboard-only navigation, breaking accessibility.
**Action:** When using `opacity: 0` to hide interactive UI elements until hovered, always pair it with an explicit `:focus-visible` state that restores `opacity: 1` and adds a visible `outline`. Additionally, ensure dynamically created toggle buttons use `aria-pressed` to communicate their state.
