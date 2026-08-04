export const shellPrimitiveNames = [
  'avatar',
  'badge',
  'button',
  'dropdown',
  'empty-state',
  'error-boundary',
  'icon-button',
  'input-wrapper',
  'link',
  'loading-indicator',
  'modal',
  'pagination',
  'section',
  'slide-over',
  'tabs',
  'toast-viewport',
] as const

export type ShellPrimitiveName = (typeof shellPrimitiveNames)[number]
export type ConformanceStateName =
  | 'default'
  | 'disabled'
  | 'empty'
  | 'error'
  | 'focus-visible'
  | 'loading'
  | 'open'
  | 'populated'
  | 'selected'

export interface ComponentConformanceFixture {
  readonly component: ShellPrimitiveName
  readonly states: readonly ConformanceStateName[]
  readonly requiredPatterns: readonly string[]
}

export const componentConformanceFixtures: readonly ComponentConformanceFixture[] = [
  { component: 'button', states: ['default', 'focus-visible', 'disabled', 'loading'], requiredPatterns: ['accessible-name'] },
  { component: 'link', states: ['default', 'focus-visible', 'disabled'], requiredPatterns: ['accessible-name'] },
  { component: 'badge', states: ['default'], requiredPatterns: ['text-alternative'] },
  { component: 'avatar', states: ['default', 'empty'], requiredPatterns: ['text-alternative'] },
  { component: 'icon-button', states: ['default', 'focus-visible', 'disabled'], requiredPatterns: ['accessible-name'] },
  { component: 'input-wrapper', states: ['default', 'focus-visible', 'disabled', 'error'], requiredPatterns: ['field'] },
  { component: 'loading-indicator', states: ['loading'], requiredPatterns: ['live-region', 'reduced-motion'] },
  { component: 'dropdown', states: ['default', 'open', 'selected', 'disabled'], requiredPatterns: ['menu', 'focus-return'] },
  { component: 'modal', states: ['open', 'error'], requiredPatterns: ['dialog', 'focus-trap', 'focus-return'] },
  { component: 'slide-over', states: ['open'], requiredPatterns: ['dialog', 'focus-trap', 'focus-return'] },
  { component: 'tabs', states: ['default', 'selected', 'disabled'], requiredPatterns: ['tabs', 'roving-tabindex'] },
  { component: 'section', states: ['default', 'empty'], requiredPatterns: ['heading-order'] },
  { component: 'empty-state', states: ['empty'], requiredPatterns: ['heading-order'] },
  { component: 'pagination', states: ['default', 'disabled'], requiredPatterns: ['navigation-label', 'current-page'] },
  { component: 'toast-viewport', states: ['populated', 'error'], requiredPatterns: ['live-region'] },
  { component: 'error-boundary', states: ['error'], requiredPatterns: ['alert', 'recovery-action'] },
]

export interface ShellReferenceState {
  readonly id: string
  readonly colorScheme: 'light' | 'dark'
  readonly viewport: 'desktop' | 'mobile'
  readonly direction: 'ltr' | 'rtl'
  readonly density: 'comfortable' | 'compact'
  readonly state: 'default' | 'dialog-open' | 'loading' | 'navigation-open' | 'validation-errors'
}

export const shellReferenceStates: readonly ShellReferenceState[] = [
  { id: 'desktop-light-default', colorScheme: 'light', viewport: 'desktop', direction: 'ltr', density: 'comfortable', state: 'default' },
  { id: 'desktop-dark-dialog', colorScheme: 'dark', viewport: 'desktop', direction: 'ltr', density: 'comfortable', state: 'dialog-open' },
  { id: 'desktop-light-validation', colorScheme: 'light', viewport: 'desktop', direction: 'ltr', density: 'comfortable', state: 'validation-errors' },
  { id: 'desktop-light-compact', colorScheme: 'light', viewport: 'desktop', direction: 'ltr', density: 'compact', state: 'loading' },
  { id: 'mobile-light-navigation', colorScheme: 'light', viewport: 'mobile', direction: 'ltr', density: 'comfortable', state: 'navigation-open' },
  { id: 'mobile-dark-rtl', colorScheme: 'dark', viewport: 'mobile', direction: 'rtl', density: 'comfortable', state: 'default' },
]
