# Theme and customize a panel

Holo Panels exposes one framework-neutral appearance contract. Configure that contract on `PanelBuilder`; the React, Vue, and Svelte renderers and the Next.js, Nuxt, and SvelteKit adapters all consume the same values. Do not copy the package stylesheet into an application or fork renderer CSS to create a theme.

Import `@holo-js/panels-ui/style.css` as described in [Packages and public subpaths](package-reference.md). The stylesheet provides the centralized light and dark defaults. Panel configuration adds only the overrides that the application declares.

## Configure a panel

Use `theme()` for the mode, density, and token overrides, `colors()` for the recognized semantic colors, and the three font methods for font stacks:

```ts
import { definePanel } from '@holo-js/panels'

export default definePanel('admin')
  .theme({
    darkMode: 'system',
    density: 'compact',
    tokens: {
      'radius-md': '0.375rem',
      'table-cell-padding-x': '0.75rem',
      'acme-chart-accent': '#0d9488',
    },
  })
  .colors({
    primary: '#0f766e',
    primaryForeground: '#ffffff',
    success: '#047857',
  })
  .font('Inter, ui-sans-serif, system-ui, sans-serif')
  .monoFont('JetBrains Mono, ui-monospace, monospace')
  .serifFont('Charter, ui-serif, Georgia, serif')
```

The recognized `colors()` keys map to `color-*` tokens:

```text
active                    backdrop                  background
border                    borderDisabled            borderStrong
borderSubtle              content                   contentDisabled
contentInverse            contentMuted              contentSubtle
danger                    dangerForeground          foreground
hover                     info                      infoForeground
muted                     mutedForeground           primary
primaryForeground         selected                  selectedForeground
success                   successForeground         surface
surfaceOverlay            surfaceRaised             surfaceSubtle
warning                   warningForeground
```

Values that are not recognized color keys are not converted into CSS variables. Put non-color or application-specific values in `theme({ tokens: { ... } })` instead.

### Precedence

Appearance resolves in this fixed order, regardless of the order in which fluent methods are called:

1. centralized light or dark defaults;
2. semantic values from `colors()` or `theme({ colors: ... })`;
3. values from `theme({ tokens: ... })`; and
4. explicit sans, mono, and serif values from `font()`, `monoFont()`, and `serifFont()`.

A token named `color-primary` therefore wins over the `primary` color key. Likewise, `font()` wins over a `font-sans` token, `monoFont()` wins over `font-mono`, and `serifFont()` wins over `font-serif`. Passing `null` to a font method removes that explicit font override so the token or centralized default applies.

Successive `theme()` calls preserve theme properties that are not supplied. A supplied `colors` or `tokens` object replaces that property; it is not deep-merged with an earlier object. Prefer one declaration for each when composing providers.

## Use a complete light or dark theme

`lightPanelTheme`, `darkPanelTheme`, and `definePanelTheme()` are exported from `@holo-js/panels`. `definePanelTheme()` starts with the centralized defaults for its color scheme and safely overlays the supplied tokens:

```ts
import { definePanel, definePanelTheme } from '@holo-js/panels'

const operationsNight = definePanelTheme('operations-night', 'dark', {
  'color-primary': '#a5b4fc',
  'color-primary-foreground': '#111827',
  'color-surface': '#111827',
  'widget-radius': '0.5rem',
})

export default definePanel('operations')
  .theme(operationsNight)
  .font('Inter, ui-sans-serif, system-ui, sans-serif')
  .monoFont('JetBrains Mono, ui-monospace, monospace')
  .serifFont('Charter, ui-serif, Georgia, serif')
```

A complete token theme has a fixed `light` or `dark` `colorScheme`; passing it to `theme()` sets the panel mode accordingly. Use the partial `theme({ darkMode: 'system', ... })` form when the panel must follow the operating-system preference.

## Semantic token groups

Token keys omit the CSS prefix. For example, `color-primary` becomes `--holo-color-primary`. The exported `panelTokenNames` tuple is the exhaustive built-in token list, `PanelTokenName` is its type, and `panelTokenVariable()` converts a built-in name to its canonical CSS variable.

| Group | Token families and responsibilities |
| --- | --- |
| Semantic color | `color-background`, surface levels, foreground/content levels, border levels, primary, danger, success, warning, info, interaction states, and backdrop |
| Geometry and density | `space-*`, `radius-*`, border widths, control heights, `density`, and icon sizes |
| Typography | Sans, serif, and mono families; font sizes and weights; line heights; and letter spacing |
| Elevation, focus, and motion | Shadows, z-index levels, focus-ring geometry and color, disabled opacity, durations, and easing curves |
| Shell and navigation | Shell background/content/border/header values and navigation background/content/item states and spacing |
| Buttons and inputs | Heights, padding, radii, primary/secondary/danger states, disabled opacity, and input background/content/border states |
| Tables and overlays | Table background/header/row/border/cell spacing plus popover and dialog surfaces, borders, radii, shadows, and backdrop |
| Notifications and loading | Notification surface/content/border/shadow/status accents and loading color, track, and size |
| Forms, relations, authentication, and widgets | Form label/help/error/spacing, relation surfaces and connector/accent, auth page/card values, and widget surface/layout values |

Component tokens usually refer back to lower-level semantic tokens. For example, `button-primary-background` defaults to `var(--holo-color-primary)`. Override the lower-level token to update every consumer, or override the component token when the exception should be local to that component family.

## Safe custom tokens

Custom token names are allowed so plugins and applications can share appearance values with their own panel content. They use the same serialization boundary as built-in tokens:

- names must start with a lowercase ASCII letter, contain only lowercase letters, digits, and hyphens, and be no longer than 128 characters;
- values must be strings which remain non-empty after trimming and are no longer than 256 characters;
- values cannot contain control characters, `;`, `{`, `}`, `<`, `>`, CSS comment delimiters, `expression(`, `url(`, `@import`, or `</style` in any letter case; and
- `undefined` overrides are ignored by the lower-level theme utility.

Use an application or plugin prefix such as `acme-chart-accent`. A custom key can otherwise collide with a built-in token added in a later compatible release. Pass token names, not raw variable names: use `acme-chart-accent`, not `--holo-acme-chart-accent`.

These checks are an injection boundary, not a CSS grammar validator. Use valid CSS values of the expected kind, keep external asset loading in declared panel assets, and do not attempt to put a stylesheet or URL in a token.

## Light, dark, system, and density behavior

`theme({ darkMode: 'light' })` fixes the light scheme, `theme({ darkMode: 'dark' })` fixes the dark scheme, and `theme({ darkMode: 'system' })` follows `prefers-color-scheme`. `system` is the default. The adapters expose the selected value as `data-theme` on the panel root, and the stylesheet also sets the matching CSS `color-scheme`.

Configured `colors`, `tokens`, and fonts are panel-root overrides and therefore remain in effect in every mode. The unoverridden semantic defaults switch with the mode. Do not customize the stylesheet's implementation-only `--holo-dark-*` staging variables; use a complete light or dark theme when every token must come from a particular scheme.

Density is semantic rather than a second stylesheet. `comfortable` is the default. `theme({ density: 'compact' })` produces `data-density="compact"` and tightens control heights, table cell padding, and form spacing through the density tokens. Application components should consume those tokens instead of branching on framework-specific markup.

The compiled discovery appearance carries `colors`, `density`, `fontFamily`, `monoFontFamily`, `serifFontFamily`, and `tokens`; `darkMode` travels alongside it. Framework adapters propagate the complete appearance to the main panel shell and their login, registration, password, verification, multi-factor, and profile surfaces. Generated routes do not need application-authored appearance plumbing.

## CSS variables and stable hooks

`--holo-*` variables derived from `panelTokenNames` are the canonical CSS customization surface. Prefer the `PanelBuilder` methods because they validate, serialize, and scope those values consistently. Directly setting a canonical variable on an application-owned descendant is appropriate only for a deliberately local exception.

The stylesheet also maps the established shadcn-family palette aliases to canonical tokens: `--hp-background`, `--hp-foreground`, `--hp-card`, `--hp-card-foreground`, `--hp-popover`, `--hp-popover-foreground`, `--hp-primary`, `--hp-primary-foreground`, `--hp-secondary`, `--hp-secondary-foreground`, `--hp-muted`, `--hp-muted-foreground`, `--hp-accent`, `--hp-accent-foreground`, `--hp-destructive`, `--hp-destructive-foreground`, `--hp-border`, `--hp-input`, `--hp-ring`, `--hp-radius`, `--hp-sidebar`, `--hp-sidebar-foreground`, `--hp-sidebar-accent`, `--hp-sidebar-accent-foreground`, and `--hp-sidebar-border`. These `--hp-*` names are compatibility aliases, not the canonical token namespace. Existing integrations may keep using them; new themes should set the corresponding `--holo-*` token through `PanelBuilder`.

Renderer-emitted `hp-*` classes and `data-slot` attributes are stable public hooks for focused application CSS and UI tests. Start at `.hp-panel` or `[data-holo-panel]`, then target a named component hook such as `.hp-button`, `.hp-field`, `.hp-table-*`, or `[data-slot="button"]`. Root `data-theme` and `data-density` attributes are also part of the appearance contract. DOM depth, element choice, incidental wrappers, selector specificity, and the package's internal rule layout are not public contracts, so do not depend on descendant position or copy internal declarations.

## Visual defaults and compatibility

The current stylesheet intentionally adopts a quieter visual baseline: neutral surfaces, lower-emphasis borders, reduced ornamental contrast, and restrained elevation. This is an intentional visual-default change, not a removal of theming capability.

The compatibility boundary is the `PanelBuilder` appearance API, built-in semantic token names, canonical `--holo-*` variables, the listed `--hp-*` palette aliases, and renderer-emitted `hp-*` and `data-slot` hooks. Exact default color values, shadow recipes, spacing values, typography values, internal dark-mode staging variables, DOM nesting, and internal CSS declarations may continue to evolve. Applications that require pixel-stable branding should declare the relevant semantic values through the public contract rather than relying on today's defaults.
