export const panelTokenNames = [
  // Semantic color
  'color-background',
  'color-surface',
  'color-surface-subtle',
  'color-surface-raised',
  'color-surface-overlay',
  'color-foreground',
  'color-muted',
  'color-muted-foreground',
  'color-content',
  'color-content-muted',
  'color-content-subtle',
  'color-content-inverse',
  'color-content-disabled',
  'color-border',
  'color-border-subtle',
  'color-border-strong',
  'color-border-disabled',
  'color-primary',
  'color-primary-foreground',
  'color-danger',
  'color-danger-foreground',
  'color-success',
  'color-success-foreground',
  'color-warning',
  'color-warning-foreground',
  'color-info',
  'color-info-foreground',
  'color-hover',
  'color-active',
  'color-selected',
  'color-selected-foreground',
  'color-backdrop',

  // Geometry and density
  'space-0',
  'space-1',
  'space-2',
  'space-3',
  'space-4',
  'space-5',
  'space-6',
  'space-8',
  'space-10',
  'space-12',
  'space-16',
  'radius-none',
  'radius-sm',
  'radius-md',
  'radius-lg',
  'radius-xl',
  'radius-full',
  'border-width',
  'border-width-strong',
  'control-height-sm',
  'control-height',
  'control-height-lg',
  'density',
  'icon-size-sm',
  'icon-size-md',
  'icon-size-lg',

  // Typography
  'font-sans',
  'font-serif',
  'font-mono',
  'font-size-xs',
  'font-size-sm',
  'font-size-md',
  'font-size-lg',
  'font-size-xl',
  'font-size-2xl',
  'font-size-3xl',
  'font-weight-normal',
  'font-weight-medium',
  'font-weight-semibold',
  'font-weight-bold',
  'line-height-tight',
  'line-height',
  'line-height-relaxed',
  'letter-spacing-tight',
  'letter-spacing-wide',

  // Elevation, focus, and motion
  'shadow-xs',
  'shadow-sm',
  'shadow-md',
  'shadow-lg',
  'shadow-xl',
  'z-dropdown',
  'z-sticky',
  'z-overlay',
  'z-modal',
  'z-toast',
  'focus-ring-color',
  'focus-ring-width',
  'focus-ring-offset',
  'opacity-disabled',
  'motion-instant',
  'motion-fast',
  'motion-normal',
  'motion-slow',
  'easing-standard',
  'easing-entrance',
  'easing-exit',

  // Shell and navigation
  'shell-background',
  'shell-content',
  'shell-border',
  'shell-header-background',
  'shell-header-height',
  'nav-background',
  'nav-content',
  'nav-item-hover',
  'nav-item-active',
  'nav-item-active-content',
  'nav-item-gap',

  // Buttons and inputs
  'button-height',
  'button-padding-x',
  'button-radius',
  'button-primary-background',
  'button-primary-content',
  'button-primary-hover',
  'button-secondary-background',
  'button-secondary-content',
  'button-secondary-hover',
  'button-danger-background',
  'button-danger-content',
  'button-danger-hover',
  'button-disabled-opacity',
  'input-height',
  'input-background',
  'input-content',
  'input-placeholder',
  'input-border',
  'input-hover-border',
  'input-focus-border',
  'input-disabled-background',
  'input-radius',

  // Tables and overlays
  'table-background',
  'table-header-background',
  'table-header-content',
  'table-row-hover',
  'table-row-selected',
  'table-border',
  'table-cell-padding-x',
  'table-cell-padding-y',
  'popover-background',
  'popover-content',
  'popover-border',
  'popover-shadow',
  'popover-radius',
  'dialog-background',
  'dialog-content',
  'dialog-border',
  'dialog-shadow',
  'dialog-radius',
  'dialog-backdrop',

  // Notifications and loading
  'notification-background',
  'notification-content',
  'notification-border',
  'notification-shadow',
  'notification-info-accent',
  'notification-success-accent',
  'notification-warning-accent',
  'notification-danger-accent',
  'loading-color',
  'loading-track',
  'loading-size',

  // Forms, relations, authentication, and widgets
  'form-label-content',
  'form-help-content',
  'form-error-content',
  'form-field-gap',
  'form-section-gap',
  'relation-background',
  'relation-content',
  'relation-border',
  'relation-connector',
  'relation-accent',
  'auth-background',
  'auth-card-background',
  'auth-card-border',
  'auth-card-shadow',
  'auth-card-width',
  'widget-background',
  'widget-content',
  'widget-border',
  'widget-header-background',
  'widget-gap',
  'widget-radius',
] as const

export type PanelTokenName = (typeof panelTokenNames)[number]
export type PanelTokenValues = Readonly<Record<PanelTokenName, string>>
export type PanelTokenOverrides = Readonly<Partial<PanelTokenValues> & Record<string, string | undefined>>
export type PanelTokenVariable = `--holo-${string}`

const TOKEN_NAME = /^[a-z][a-z0-9-]*$/u
const MAX_TOKEN_NAME_LENGTH = 128
const MAX_TOKEN_VALUE_LENGTH = 256

function safeTokenName(name: string): string {
  if (name.length > MAX_TOKEN_NAME_LENGTH || !TOKEN_NAME.test(name)) {
    throw new Error(`Panel theme token "${name}" has an unsafe name`)
  }
  return name
}

function safeTokenValue(name: string, value: string): string {
  const resolved = value.trim()
  const hasUnsafeCharacter = [...resolved].some(character => ';{}<>'.includes(character) || character.charCodeAt(0) <= 31 || character.charCodeAt(0) === 127)
  if (!resolved || resolved.length > MAX_TOKEN_VALUE_LENGTH || hasUnsafeCharacter || /\/\*|\*\/|(?:expression|url)\s*\(/iu.test(resolved) || /@import|<\/style/iu.test(resolved)) {
    throw new Error(`Panel theme token "${name}" has an unsafe value`)
  }
  return resolved
}

export interface PanelTheme {
  readonly name: string
  readonly colorScheme: 'light' | 'dark'
  readonly tokens: PanelTokenValues & Readonly<Record<string, string>>
}

const sharedTokenDefaults = {
  'space-0': '0',
  'space-1': '0.25rem',
  'space-2': '0.5rem',
  'space-3': '0.75rem',
  'space-4': '1rem',
  'space-5': '1.25rem',
  'space-6': '1.5rem',
  'space-8': '2rem',
  'space-10': '2.5rem',
  'space-12': '3rem',
  'space-16': '4rem',
  'radius-none': '0',
  'radius-sm': '0.25rem',
  'radius-md': '0.45rem',
  'radius-lg': '0.65rem',
  'radius-xl': '0.9rem',
  'radius-full': '9999px',
  'border-width': '1px',
  'border-width-strong': '2px',
  'control-height-sm': '2rem',
  'control-height': '2.25rem',
  'control-height-lg': '2.75rem',
  'density': '1',
  'icon-size-sm': '1rem',
  'icon-size-md': '1.25rem',
  'icon-size-lg': '1.5rem',
  'font-sans': 'ui-sans-serif, system-ui, sans-serif',
  'font-serif': 'ui-serif, Georgia, serif',
  'font-mono': 'ui-monospace, monospace',
  'font-size-xs': '0.75rem',
  'font-size-sm': '0.875rem',
  'font-size-md': '1rem',
  'font-size-lg': '1.25rem',
  'font-size-xl': '1.5rem',
  'font-size-2xl': '1.875rem',
  'font-size-3xl': '2.25rem',
  'font-weight-normal': '400',
  'font-weight-medium': '500',
  'font-weight-semibold': '600',
  'font-weight-bold': '700',
  'line-height-tight': '1.25',
  'line-height': '1.5',
  'line-height-relaxed': '1.75',
  'letter-spacing-tight': '-0.015em',
  'letter-spacing-wide': '0.025em',
  'shadow-xs': '0 1px 1px rgb(0 0 0 / 0.03)',
  'shadow-sm': '0 1px 2px rgb(0 0 0 / 0.04)',
  'shadow-md': '0 4px 12px -2px rgb(0 0 0 / 0.12)',
  'shadow-lg': '0 16px 40px -12px rgb(0 0 0 / 0.24)',
  'shadow-xl': '0 24px 64px -16px rgb(0 0 0 / 0.3)',
  'z-dropdown': '1000',
  'z-sticky': '1100',
  'z-overlay': '1200',
  'z-modal': '1300',
  'z-toast': '1400',
  'focus-ring-width': '2px',
  'focus-ring-offset': '2px',
  'opacity-disabled': '0.5',
  'motion-instant': '0ms',
  'motion-fast': '120ms',
  'motion-normal': '200ms',
  'motion-slow': '320ms',
  'easing-standard': 'cubic-bezier(0.2, 0, 0, 1)',
  'easing-entrance': 'cubic-bezier(0, 0, 0.2, 1)',
  'easing-exit': 'cubic-bezier(0.4, 0, 1, 1)',
  'shell-background': 'var(--holo-color-background)',
  'shell-content': 'var(--holo-color-content)',
  'shell-border': 'var(--holo-color-border)',
  'shell-header-background': 'var(--holo-color-surface)',
  'shell-header-height': '4rem',
  'nav-background': 'var(--holo-color-surface)',
  'nav-content': 'var(--holo-color-content-muted)',
  'nav-item-hover': 'var(--holo-color-hover)',
  'nav-item-active': 'var(--holo-color-selected)',
  'nav-item-active-content': 'var(--holo-color-selected-foreground)',
  'nav-item-gap': 'var(--holo-space-1)',
  'button-height': 'var(--holo-control-height)',
  'button-padding-x': 'var(--holo-space-4)',
  'button-radius': 'var(--holo-radius-md)',
  'button-primary-background': 'var(--holo-color-primary)',
  'button-primary-content': 'var(--holo-color-primary-foreground)',
  'button-primary-hover': 'color-mix(in srgb, var(--holo-color-primary) 88%, black)',
  'button-secondary-background': 'var(--holo-color-surface)',
  'button-secondary-content': 'var(--holo-color-content)',
  'button-secondary-hover': 'var(--holo-color-hover)',
  'button-danger-background': 'var(--holo-color-danger)',
  'button-danger-content': 'var(--holo-color-danger-foreground)',
  'button-danger-hover': 'color-mix(in srgb, var(--holo-color-danger) 88%, black)',
  'button-disabled-opacity': 'var(--holo-opacity-disabled)',
  'input-height': 'var(--holo-control-height)',
  'input-background': 'var(--holo-color-surface)',
  'input-content': 'var(--holo-color-content)',
  'input-placeholder': 'var(--holo-color-content-subtle)',
  'input-border': 'var(--holo-color-border)',
  'input-hover-border': 'var(--holo-color-border-strong)',
  'input-focus-border': 'var(--holo-focus-ring-color)',
  'input-disabled-background': 'var(--holo-color-surface-subtle)',
  'input-radius': 'var(--holo-radius-md)',
  'table-background': 'var(--holo-color-surface)',
  'table-header-background': 'var(--holo-color-surface-subtle)',
  'table-header-content': 'var(--holo-color-content-muted)',
  'table-row-hover': 'var(--holo-color-hover)',
  'table-row-selected': 'var(--holo-color-selected)',
  'table-border': 'var(--holo-color-border)',
  'table-cell-padding-x': 'var(--holo-space-4)',
  'table-cell-padding-y': 'var(--holo-space-3)',
  'popover-background': 'var(--holo-color-surface-overlay)',
  'popover-content': 'var(--holo-color-content)',
  'popover-border': 'var(--holo-color-border)',
  'popover-shadow': 'var(--holo-shadow-lg)',
  'popover-radius': 'var(--holo-radius-lg)',
  'dialog-background': 'var(--holo-color-surface-overlay)',
  'dialog-content': 'var(--holo-color-content)',
  'dialog-border': 'var(--holo-color-border)',
  'dialog-shadow': 'var(--holo-shadow-xl)',
  'dialog-radius': 'var(--holo-radius-xl)',
  'dialog-backdrop': 'var(--holo-color-backdrop)',
  'notification-background': 'var(--holo-color-surface-overlay)',
  'notification-content': 'var(--holo-color-content)',
  'notification-border': 'var(--holo-color-border)',
  'notification-shadow': 'var(--holo-shadow-lg)',
  'notification-info-accent': 'var(--holo-color-info)',
  'notification-success-accent': 'var(--holo-color-success)',
  'notification-warning-accent': 'var(--holo-color-warning)',
  'notification-danger-accent': 'var(--holo-color-danger)',
  'loading-color': 'var(--holo-color-primary)',
  'loading-track': 'var(--holo-color-border-subtle)',
  'loading-size': '1.25rem',
  'form-label-content': 'var(--holo-color-content)',
  'form-help-content': 'var(--holo-color-content-muted)',
  'form-error-content': 'var(--holo-color-danger)',
  'form-field-gap': 'var(--holo-space-2)',
  'form-section-gap': 'var(--holo-space-6)',
  'relation-background': 'transparent',
  'relation-content': 'var(--holo-color-content)',
  'relation-border': 'var(--holo-color-border)',
  'relation-connector': 'var(--holo-color-content-subtle)',
  'relation-accent': 'var(--holo-color-primary)',
  'auth-background': 'var(--holo-color-background)',
  'auth-card-background': 'var(--holo-color-surface)',
  'auth-card-border': 'var(--holo-color-border)',
  'auth-card-shadow': 'var(--holo-shadow-xl)',
  'auth-card-width': '28rem',
  'widget-background': 'var(--holo-color-surface)',
  'widget-content': 'var(--holo-color-content)',
  'widget-border': 'var(--holo-color-border)',
  'widget-header-background': 'var(--holo-color-surface-subtle)',
  'widget-gap': 'var(--holo-space-4)',
  'widget-radius': 'var(--holo-radius-lg)',
} as const

const lightTokenDefaults = {
  ...sharedTokenDefaults,
  'color-background': '#f7f7f8',
  'color-surface': '#ffffff',
  'color-surface-subtle': '#f4f4f5',
  'color-surface-raised': '#ffffff',
  'color-surface-overlay': '#ffffff',
  'color-foreground': '#18181b',
  'color-muted': '#71717a',
  'color-muted-foreground': '#71717a',
  'color-content': '#18181b',
  'color-content-muted': '#52525b',
  'color-content-subtle': '#71717a',
  'color-content-inverse': '#ffffff',
  'color-content-disabled': '#a1a1aa',
  'color-border': '#e4e4e7',
  'color-border-subtle': '#f0f0f2',
  'color-border-strong': '#a1a1aa',
  'color-border-disabled': '#e4e4e7',
  'color-primary': '#18181b',
  'color-primary-foreground': '#ffffff',
  'color-danger': '#b42318',
  'color-danger-foreground': '#ffffff',
  'color-success': '#067647',
  'color-success-foreground': '#ffffff',
  'color-warning': '#b54708',
  'color-warning-foreground': '#ffffff',
  'color-info': '#175cd3',
  'color-info-foreground': '#ffffff',
  'color-hover': '#f4f4f5',
  'color-active': '#e4e4e7',
  'color-selected': '#e4e4e7',
  'color-selected-foreground': '#18181b',
  'color-backdrop': 'rgb(9 9 11 / 0.55)',
  'focus-ring-color': '#a1a1aa',
} satisfies PanelTokenValues

const darkTokenDefaults = {
  ...sharedTokenDefaults,
  'color-background': '#0c111d',
  'color-surface': '#161d2d',
  'color-surface-subtle': '#1c2536',
  'color-surface-raised': '#20293a',
  'color-surface-overlay': '#20293a',
  'color-foreground': '#f1f5f9',
  'color-muted': '#a7b1c2',
  'color-muted-foreground': '#a7b1c2',
  'color-content': '#f1f5f9',
  'color-content-muted': '#cbd5e1',
  'color-content-subtle': '#a7b1c2',
  'color-content-inverse': '#101828',
  'color-content-disabled': '#667085',
  'color-border': '#344054',
  'color-border-subtle': '#293548',
  'color-border-strong': '#667085',
  'color-border-disabled': '#344054',
  'color-primary': '#8da2fb',
  'color-primary-foreground': '#101828',
  'color-danger': '#f97066',
  'color-danger-foreground': '#1f0806',
  'color-success': '#47cd89',
  'color-success-foreground': '#052e1c',
  'color-warning': '#fdb022',
  'color-warning-foreground': '#341a04',
  'color-info': '#84adff',
  'color-info-foreground': '#102a56',
  'color-hover': '#20293a',
  'color-active': '#293548',
  'color-selected': '#344054',
  'color-selected-foreground': '#f1f5f9',
  'color-backdrop': 'rgb(2 6 23 / 0.72)',
  'focus-ring-color': '#a4b5fc',
  'shadow-xs': '0 1px 1px rgb(0 0 0 / 0.18)',
  'shadow-md': '0 4px 12px -2px rgb(0 0 0 / 0.38)',
  'shadow-xl': '0 24px 64px -16px rgb(0 0 0 / 0.68)',
} satisfies PanelTokenValues

export const lightPanelTheme: PanelTheme = Object.freeze({
  name: 'light',
  colorScheme: 'light',
  tokens: Object.freeze(lightTokenDefaults),
})

export const darkPanelTheme: PanelTheme = Object.freeze({
  name: 'dark',
  colorScheme: 'dark',
  tokens: Object.freeze(darkTokenDefaults),
})

export function definePanelTheme(
  name: string,
  colorScheme: PanelTheme['colorScheme'],
  overrides: PanelTokenOverrides = {},
): PanelTheme {
  const normalizedName = name.trim()
  if (!normalizedName) {
    throw new Error('Panel theme names cannot be empty')
  }

  const base = colorScheme === 'dark' ? darkPanelTheme.tokens : lightPanelTheme.tokens
  const resolvedOverrides: Record<string, string> = {}
  for (const [token, unresolved] of Object.entries(overrides).sort(compareTokenEntries)) {
    safeTokenName(token)
    if (typeof unresolved === 'string') resolvedOverrides[token] = safeTokenValue(token, unresolved)
  }
  const tokens = Object.fromEntries(
    Object.entries({ ...base, ...resolvedOverrides }).map(([token, value]) => [token, safeTokenValue(token, value)]),
  ) as PanelTokenValues & Readonly<Record<string, string>>
  return Object.freeze({
    name: normalizedName,
    colorScheme,
    tokens: Object.freeze(tokens),
  })
}

export function panelTokenVariable(name: PanelTokenName): `--holo-${PanelTokenName}` {
  return `--holo-${name}`
}

const panelColorTokens = Object.freeze({
  active: 'color-active',
  backdrop: 'color-backdrop',
  background: 'color-background',
  border: 'color-border',
  borderDisabled: 'color-border-disabled',
  borderStrong: 'color-border-strong',
  borderSubtle: 'color-border-subtle',
  content: 'color-content',
  contentDisabled: 'color-content-disabled',
  contentInverse: 'color-content-inverse',
  contentMuted: 'color-content-muted',
  contentSubtle: 'color-content-subtle',
  danger: 'color-danger',
  dangerForeground: 'color-danger-foreground',
  foreground: 'color-foreground',
  hover: 'color-hover',
  info: 'color-info',
  infoForeground: 'color-info-foreground',
  muted: 'color-muted',
  mutedForeground: 'color-muted-foreground',
  primary: 'color-primary',
  primaryForeground: 'color-primary-foreground',
  selected: 'color-selected',
  selectedForeground: 'color-selected-foreground',
  success: 'color-success',
  successForeground: 'color-success-foreground',
  surface: 'color-surface',
  surfaceOverlay: 'color-surface-overlay',
  surfaceRaised: 'color-surface-raised',
  surfaceSubtle: 'color-surface-subtle',
  warning: 'color-warning',
  warningForeground: 'color-warning-foreground',
} satisfies Readonly<Record<string, PanelTokenName>>)

export interface PanelThemeVariablesInput {
  readonly colors?: Readonly<Record<string, unknown>>
  readonly fontFamily?: unknown
  readonly monoFontFamily?: unknown
  readonly serifFontFamily?: unknown
  readonly tokens?: Readonly<Record<string, unknown>>
}

function compareTokenEntries([left]: readonly [string, unknown], [right]: readonly [string, unknown]): number {
  return left < right ? -1 : left > right ? 1 : 0
}

export function panelThemeVariables(theme: PanelThemeVariablesInput): Readonly<Record<PanelTokenVariable, string>> {
  const variables = new Map<PanelTokenVariable, string>()
  const setVariable = (name: string, value: string): void => {
    const variable = `--holo-${name}` as PanelTokenVariable
    // Moving an overridden variable to the end keeps serialized precedence explicit.
    variables.delete(variable)
    variables.set(variable, safeTokenValue(name, value))
  }

  // CSS owns defaults. Configuration layers then apply colors, arbitrary tokens,
  // and finally explicit font-family options in increasing precedence.
  for (const [color, token] of Object.entries(panelColorTokens)) {
    const value = theme.colors?.[color]
    if (typeof value === 'string') setVariable(token, value)
  }
  for (const [name, value] of Object.entries(theme.tokens ?? {}).sort(compareTokenEntries)) {
    safeTokenName(name)
    if (typeof value === 'string') setVariable(name, value)
  }
  for (const [name, value] of [
    ['font-sans', theme.fontFamily],
    ['font-mono', theme.monoFontFamily],
    ['font-serif', theme.serifFontFamily],
  ] as const) {
    if (typeof value === 'string') setVariable(name, value)
  }

  return Object.freeze(Object.fromEntries(variables)) as Readonly<Record<PanelTokenVariable, string>>
}

export function panelThemeStyleAttribute(theme: PanelThemeVariablesInput): string {
  return Object.entries(panelThemeVariables(theme)).map(([name, value]) => `${name}:${value}`).join(';')
}

interface PanelConfigurationStyle {
  readonly branding?: { readonly logoHeight?: string | null }
  readonly layout?: {
    readonly collapsedSidebarWidth: string
    readonly maxContentWidth: string
    readonly sidebarWidth: string
  }
  readonly theme: PanelThemeVariablesInput
}

const contentWidths = Object.freeze({
  '3xs': '16rem',
  '2xs': '18rem',
  xs: '20rem',
  sm: '24rem',
  md: '28rem',
  lg: '32rem',
  xl: '36rem',
  '2xl': '42rem',
  '3xl': '48rem',
  '4xl': '56rem',
  '5xl': '64rem',
  '6xl': '72rem',
  '7xl': '80rem',
  'screen-2xl': '96rem',
  'screen-xl': '80rem',
  'screen-lg': '64rem',
  'screen-md': '48rem',
  'screen-sm': '40rem',
  full: '100%',
})

export function panelContentWidthValue(value: string): string {
  return value in contentWidths ? contentWidths[value as keyof typeof contentWidths] : value
}

export function panelConfigurationVariables(configuration: PanelConfigurationStyle): Readonly<Record<string, string>> {
  const layout = configuration.layout
  const maxContentWidth = layout?.maxContentWidth
  return Object.freeze({
    ...panelThemeVariables(configuration.theme),
    ...(configuration.branding?.logoHeight ? { '--hp-brand-logo-height': configuration.branding.logoHeight } : {}),
    ...(layout ? {
      '--hp-collapsed-sidebar-width': layout.collapsedSidebarWidth,
      '--hp-content-max-width': maxContentWidth ? panelContentWidthValue(maxContentWidth) : maxContentWidth,
      '--hp-sidebar-width': layout.sidebarWidth,
    } : {}),
  })
}

export function panelConfigurationStyleAttribute(configuration: PanelConfigurationStyle): string {
  return Object.entries(panelConfigurationVariables(configuration)).map(([name, value]) => `${name}:${value}`).join(';')
}
