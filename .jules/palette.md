## 2024-05-20 - Synchronize aria-label with dynamic title changes
**Learning:** For dynamic icon-only buttons, updating the `title` attribute for visual tooltips does not automatically update the accessibility tree. Screen readers rely on `aria-label`, so it must be explicitly synchronized with state changes to prevent assistive tech from announcing stale or incorrect labels.
**Action:** Always write `element.setAttribute('aria-label', newLabel)` whenever `element.title` is updated on an icon-only button without visible text.

## 2024-05-21 - Use aria-live for transient notifications
**Learning:** Toast notifications (like the mode overlay) appear briefly on screen. Sighted users see them, but screen readers miss them because they don't receive focus. By adding `role="status"` and `aria-live="polite"` to the notification container, assistive technology will automatically announce the text when the content changes, without interrupting the user.
**Action:** Always ensure dynamic, visually transient notification elements include `aria-live` attributes to guarantee screen reader users receive the same feedback as sighted users.
