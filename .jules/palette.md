## 2024-06-30 - Dynamic Text Masking Anti-Pattern
**Learning:** When adding `aria-label` attributes to elements, ensure it doesn't mask dynamic text inside the element. For example, a button showing 'Reset (0)' where '(0)' changes dynamically will not be read by screen readers if it has a static `aria-label="Reset"`.
**Action:** Verify if a button's inner text changes dynamically before adding a static `aria-label`. If it does, ensure the `aria-label` is either updated dynamically along with the text, or avoid adding it if the visible text is sufficiently descriptive.

## 2026-07-08 - Syncing ARIA States with Visual Toggles
**Learning:** When toggling visual states (like expanding/collapsing a section via CSS classes), ARIA attributes like `aria-expanded` must be explicitly updated in JavaScript to match the visual state, otherwise screen readers fall out of sync.
**Action:** Always ensure ARIA attributes are updated in the same event handlers that handle the visual state changes.

## 2024-07-14 - Semantic Button Types
**Learning:** Buttons without an explicit `type` attribute implicitly default to `type="submit"`. In a UI with many interactive buttons but no actual forms, this can cause unintended form submissions or page reloads if elements get wrapped in a `<form>` tag in the future.
**Action:** Always explicitly add `type="button"` to buttons that act as UI triggers and are not meant to submit data.

## 2025-02-14 - Checkbox-Based Toggle UI Accessibility
**Learning:** When using `<input type="checkbox">` elements visually styled as toggle switches, screen readers will announce them as standard checkboxes (checked/unchecked) unless explicitly told otherwise. This mismatch between visual appearance (switch) and auditory feedback (checkbox) can confuse users.
**Action:** Always add `role="switch"` to checkboxes styled as toggle switches to ensure screen readers announce them properly as switches (on/off).
