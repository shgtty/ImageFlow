## 2024-06-30 - Dynamic Text Masking Anti-Pattern
**Learning:** When adding `aria-label` attributes to elements, ensure it doesn't mask dynamic text inside the element. For example, a button showing 'Reset (0)' where '(0)' changes dynamically will not be read by screen readers if it has a static `aria-label="Reset"`.
**Action:** Verify if a button's inner text changes dynamically before adding a static `aria-label`. If it does, ensure the `aria-label` is either updated dynamically along with the text, or avoid adding it if the visible text is sufficiently descriptive.
