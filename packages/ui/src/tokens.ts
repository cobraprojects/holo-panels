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
  'radius-md': '0.5rem',
  'radius-lg': '0.75rem',
  'font-sans': 'ui-sans-serif, system-ui, sans-serif',
  'font-mono': 'ui-monospace, monospace',
  'font-size-sm': '0.875rem',
  'font-size-md': '1rem',
  'font-size-lg': '1.25rem',
  'line-height': '1.5',
  'control-height': '2.5rem',
  'density': '1',
  'shadow-sm': '0 1px 2px rgb(0 0 0 / 0.08)',
  'shadow-lg': '0 20px 25px -5px rgb(0 0 0 / 0.18)',
  'focus-ring-width': '3px',
  'motion-fast': '120ms',
  'motion-normal': '200ms',
} as const

export const lightPanelTheme: PanelTheme = {
  name: 'light',
  colorScheme: 'light',
  tokens: {
    ...sharedTokens,
    'color-background': '#f8fafc',
    'color-surface': '#ffffff',
    'color-surface-raised': '#ffffff',
    'color-foreground': '#172033',
    'color-muted': '#64748b',
    'color-border': '#d8e0eb',
    'color-primary': '#3455db',
    'color-primary-foreground': '#ffffff',
    'color-danger': '#b42318',
    'color-danger-foreground': '#ffffff',
    'color-success': '#067647',
    'color-success-foreground': '#ffffff',
    'color-warning': '#b54708',
    'color-warning-foreground': '#ffffff',
    'focus-ring-color': '#6b83e8',
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
  return {
    name: normalizedName,
    colorScheme,
    tokens: Object.freeze({ ...base, ...overrides }),
  }
}

export function panelTokenVariable(name: PanelTokenName): `--holo-${PanelTokenName}` {
  return `--holo-${name}`
}
