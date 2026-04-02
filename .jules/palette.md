## 2024-05-20 - Synchronize aria-label with dynamic title changes
**Learning:** For dynamic icon-only buttons, updating the `title` attribute for visual tooltips does not automatically update the accessibility tree. Screen readers rely on `aria-label`, so it must be explicitly synchronized with state changes to prevent assistive tech from announcing stale or incorrect labels.
**Action:** Always write `element.setAttribute('aria-label', newLabel)` whenever `element.title` is updated on an icon-only button without visible text.
