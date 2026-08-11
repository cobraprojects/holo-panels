export const panelTokenNames = [
  'color-background',
  'color-surface',
  'color-surface-raised',
  'color-foreground',
  'color-muted',
  'color-border',
  'color-primary',
  'color-primary-foreground',
  'color-danger',
  'color-danger-foreground',
  'color-success',
  'color-success-foreground',
  'color-warning',
  'color-warning-foreground',
  'space-1',
  'space-2',
  'space-3',
  'space-4',
  'space-6',
  'space-8',
  'radius-sm',
  'radius-md',
  'radius-lg',
  'font-sans',
  'font-mono',
  'font-size-sm',
  'font-size-md',
  'font-size-lg',
  'line-height',
  'control-height',
  'density',
  'shadow-sm',
  'shadow-lg',
  'focus-ring-color',
  'focus-ring-width',
  'motion-fast',
  'motion-normal',
] as const

export type PanelTokenName = (typeof panelTokenNames)[number]
export type PanelTokenValues = Readonly<Record<PanelTokenName, string>>
export type PanelTokenOverrides = Readonly<Partial<PanelTokenValues>>

function safeTokenValue(name: string, value: string): string {
  const resolved = value.trim()
  const hasUnsafeCharacter = [...resolved].some(character => ';{}<>'.includes(character) || character.charCodeAt(0) <= 31 || character.charCodeAt(0) === 127)
  if (!resolved || resolved.length > 256 || hasUnsafeCharacter || /(?:expression|url)\s*\(/iu.test(resolved) || /@import|<\/style/iu.test(resolved)) {
    throw new Error(`Panel theme token "${name}" has an unsafe value`)
  }
  return resolved
}

export interface PanelTheme {
  readonly name: string
  readonly colorScheme: 'light' | 'dark'
  readonly tokens: PanelTokenValues
}

const sharedTokens = {
  'space-1': '0.25rem',
  'space-2': '0.5rem',
  'space-3': '0.75rem',
  'space-4': '1rem',
  'space-6': '1.5rem',
  'space-8': '2rem',
  'radius-sm': '0.25rem',
  'radius-md': '0.45rem',
  'radius-lg': '0.65rem',
  'font-sans': 'ui-sans-serif, system-ui, sans-serif',
  'font-mono': 'ui-monospace, monospace',
  'font-size-sm': '0.875rem',
  'font-size-md': '1rem',
  'font-size-lg': '1.25rem',
  'line-height': '1.5',
  'control-height': '2.25rem',
  'density': '1',
  'shadow-sm': '0 1px 2px rgb(0 0 0 / 0.04)',
  'shadow-lg': '0 16px 40px -12px rgb(0 0 0 / 0.24)',
  'focus-ring-width': '2px',
  'motion-fast': '120ms',
  'motion-normal': '200ms',
} as const

export const lightPanelTheme: PanelTheme = {
  name: 'light',
  colorScheme: 'light',
  tokens: {
    ...sharedTokens,
    'color-background': '#f7f7f8',
    'color-surface': '#ffffff',
    'color-surface-raised': '#ffffff',
    'color-foreground': '#18181b',
    'color-muted': '#71717a',
    'color-border': '#e4e4e7',
    'color-primary': '#18181b',
    'color-primary-foreground': '#ffffff',
    'color-danger': '#b42318',
    'color-danger-foreground': '#ffffff',
    'color-success': '#067647',
    'color-success-foreground': '#ffffff',
    'color-warning': '#b54708',
    'color-warning-foreground': '#ffffff',
    'focus-ring-color': '#a1a1aa',
  },
}

export const darkPanelTheme: PanelTheme = {
  name: 'dark',
  colorScheme: 'dark',
  tokens: {
    ...sharedTokens,
    'color-background': '#0c111d',
    'color-surface': '#161d2d',
    'color-surface-raised': '#20293a',
    'color-foreground': '#f1f5f9',
    'color-muted': '#a7b1c2',
    'color-border': '#344054',
    'color-primary': '#8da2fb',
    'color-primary-foreground': '#101828',
    'color-danger': '#f97066',
    'color-danger-foreground': '#1f0806',
    'color-success': '#47cd89',
    'color-success-foreground': '#052e1c',
    'color-warning': '#fdb022',
    'color-warning-foreground': '#341a04',
    'focus-ring-color': '#a4b5fc',
  },
}

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
  const tokens = Object.fromEntries(Object.entries({ ...base, ...overrides }).map(([token, value]) => [token, safeTokenValue(token, value)])) as unknown as PanelTokenValues
  return {
    name: normalizedName,
    colorScheme,
    tokens: Object.freeze(tokens),
  }
}

export function panelTokenVariable(name: PanelTokenName): `--holo-${PanelTokenName}` {
  return `--holo-${name}`
}

const panelColorTokens = Object.freeze({
  background: 'color-background',
  border: 'color-border',
  danger: 'color-danger',
  dangerForeground: 'color-danger-foreground',
  foreground: 'color-foreground',
  muted: 'color-muted',
  primary: 'color-primary',
  primaryForeground: 'color-primary-foreground',
  success: 'color-success',
  successForeground: 'color-success-foreground',
  surface: 'color-surface',
  surfaceRaised: 'color-surface-raised',
  warning: 'color-warning',
  warningForeground: 'color-warning-foreground',
} satisfies Readonly<Record<string, PanelTokenName>>)

export function panelThemeVariables(theme: { readonly colors?: Readonly<Record<string, unknown>>, readonly fontFamily?: unknown, readonly tokens?: Readonly<Record<string, unknown>> }): Readonly<Partial<Record<`--holo-${PanelTokenName}`, string>>> {
  const variables: Partial<Record<`--holo-${PanelTokenName}`, string>> = {}
  for (const [color, token] of Object.entries(panelColorTokens)) {
    const value = theme.colors?.[color]
    if (typeof value === 'string') variables[panelTokenVariable(token)] = safeTokenValue(token, value)
  }
  for (const name of panelTokenNames) {
    const value = theme.tokens?.[name]
    if (typeof value === 'string') variables[panelTokenVariable(name)] = safeTokenValue(name, value)
  }
  if (typeof theme.fontFamily === 'string') variables['--holo-font-sans'] = safeTokenValue('font-sans', theme.fontFamily)
  return Object.freeze(variables)
}

export function panelThemeStyleAttribute(theme: { readonly colors?: Readonly<Record<string, unknown>>, readonly fontFamily?: unknown, readonly tokens?: Readonly<Record<string, unknown>> }): string {
  return Object.entries(panelThemeVariables(theme)).map(([name, value]) => `${name}:${value}`).join(';')
}

interface PanelConfigurationStyle {
  readonly branding?: { readonly logoHeight?: string | null }
  readonly layout?: {
    readonly collapsedSidebarWidth: string
    readonly maxContentWidth: string
    readonly sidebarWidth: string
  }
  readonly theme: { readonly colors?: Readonly<Record<string, unknown>>, readonly fontFamily?: unknown, readonly tokens?: Readonly<Record<string, unknown>> }
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
