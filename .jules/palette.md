## 2024-05-20 - Synchronize aria-label with dynamic title changes
**Learning:** For dynamic icon-only buttons, updating the `title` attribute for visual tooltips does not automatically update the accessibility tree. Screen readers rely on `aria-label`, so it must be explicitly synchronized with state changes to prevent assistive tech from announcing stale or incorrect labels.
**Action:** Always write `element.setAttribute('aria-label', newLabel)` whenever `element.title` is updated on an icon-only button without visible text.

## 2024-05-21 - Use aria-live for transient notifications
**Learning:** Toast notifications (like the mode overlay) appear briefly on screen. Sighted users see them, but screen readers miss them because they don't receive focus. By adding `role="status"` and `aria-live="polite"` to the notification container, assistive technology will automatically announce the text when the content changes, without interrupting the user.
**Action:** Always ensure dynamic, visually transient notification elements include `aria-live` attributes to guarantee screen reader users receive the same feedback as sighted users.

## 2024-05-22 - Synchronize aria-valuetext for range inputs
**Learning:** For `<input type="range">` elements, screen readers announce only their raw numerical value (e.g., "15") by default. When the UI displays contextual information like "15 / 100", screen reader users miss this context. By synchronizing the `aria-valuetext` attribute with the visible text, we provide critical context and parity with sighted users.
**Action:** Always set `aria-valuetext` on range sliders when a formatted display value is available and updated dynamically.

## 2024-05-23 - Provide visual feedback for asynchronous actions
**Learning:** Actions that trigger asynchronous operations, like fetching data from an API, must provide immediate visual feedback. A button without a loading state or disabled state can lead users to think the app is unresponsive and click repeatedly, causing race conditions and a frustrating UX.
**Action:** Always disable buttons and provide a loading indicator (e.g., a spinning icon or "loading..." text) while a network request is pending, ensuring it is reset in a `finally` block to handle both success and error states.

## 2024-05-24 - Provide focus-visible styles for input range sliders
**Learning:** In highly customized web apps with dark backgrounds, default focus outlines for range sliders can be unnoticeable, breaking keyboard accessibility. When implementing custom thumbs for sliders, we also need to account for when the element itself receives keyboard focus and provide an explicit visual indicator.
**Action:** Provide `:focus-visible` styles with sufficient outline offsets and thumb pseudo-class highlighting (`:focus-visible::-webkit-slider-thumb`) to ensure the slider is clearly identifiable during keyboard navigation.

## 2024-05-25 - Apply aria-live to localized transient indicators
**Learning:** The application uses multiple transient visual indicators (like the `#speed-indicator`) to display rapidly changing state to sighted users. While the main toast notification (`#mode-overlay`) correctly used `aria-live`, other localized indicators like the speed indicator were missing it, meaning screen reader users missed important contextual feedback about their actions (e.g. changing scroll speed).
**Action:** Apply `role="status"` and `aria-live="polite"` to all elements that display visually transient information, not just the primary notification area, to ensure complete feature parity for assistive tech.

## 2024-05-25 - Implement accessible custom modals
**Learning:** Custom UI modals (like the file selector) are completely invisible to screen readers unless marked with `role="dialog"` and `aria-modal="true"`. Furthermore, without managing focus (shifting focus into the modal when opened, and restoring it to the previous active element when closed), keyboard users lose their place in the UI and struggle to interact with the new content.
**Action:** Always ensure custom modals have `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, and explicit JavaScript logic to manage focus state changes and support the `Escape` key for closing.

## 2024-05-26 - Add focus-visible to custom modal elements
**Learning:** Custom UI modals without explicit `:focus-visible` styling for interactive child elements (like inputs and buttons) can suffer from poor keyboard focus visibility, especially in dark mode where default browser outlines are often barely visible. Also, inline styles like `outline:none` completely break keyboard accessibility and must be removed.
**Action:** Always test keyboard navigation inside custom modals. Provide explicit high-contrast `:focus-visible` styles for `[role="dialog"] button` and `[role="dialog"] input` to ensure focus is clearly visible for keyboard users.
