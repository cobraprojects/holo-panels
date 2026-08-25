# Holo Panels renderer reference states

Every renderer uses the exported `shellReferenceStates` collection. A reference capture must use `@holo-js/panels-ui/style.css` with the default token values and a deterministic clock, locale, data set, and animation-disabled environment.

The required shell captures are:

| ID | Viewport | Theme | Direction | Density | State |
| --- | --- | --- | --- | --- | --- |
| `desktop-light-default` | desktop | light | LTR | comfortable | default |
| `desktop-dark-dialog` | desktop | dark | LTR | comfortable | dialog open |
| `desktop-light-validation` | desktop | light | LTR | comfortable | validation errors |
| `desktop-light-compact` | desktop | light | LTR | compact | loading |
| `mobile-light-navigation` | mobile | light | LTR | comfortable | navigation open |
| `mobile-dark-rtl` | mobile | dark | RTL | comfortable | default |

Screenshots are reference evidence, not implementation input. Observable keyboard behavior, accessible semantics, content, focus state, layout, and semantic token usage must match across React, Vue, and Svelte; framework-specific DOM wrappers may differ.
