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
