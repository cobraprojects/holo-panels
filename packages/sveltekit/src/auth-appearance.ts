import { panelThemeVariables } from '@holo-js/panels-svelte'

export interface SvelteKitPanelAuthAppearance {
  readonly colors?: Readonly<Record<string, string>>
  readonly density?: 'comfortable' | 'compact'
  readonly fontFamily?: string | null
  readonly monoFontFamily?: string | null
  readonly serifFontFamily?: string | null
  readonly tokens?: Readonly<Record<string, string>>
}

export function svelteKitPanelAuthAppearanceVariables(
  appearance?: SvelteKitPanelAuthAppearance,
  themeColors?: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  const colors = themeColors || appearance?.colors
    ? { ...themeColors, ...appearance?.colors }
    : undefined
  return panelThemeVariables({
    colors,
    fontFamily: appearance?.fontFamily,
    monoFontFamily: appearance?.monoFontFamily,
    serifFontFamily: appearance?.serifFontFamily,
    tokens: appearance?.tokens,
  })
}

export function svelteKitPanelAuthAppearanceStyleAttribute(
  appearance?: SvelteKitPanelAuthAppearance,
  themeColors?: Readonly<Record<string, string>>,
): string {
  const declarations = Object.entries(svelteKitPanelAuthAppearanceVariables(appearance, themeColors))
    .map(([name, value]) => `${name}:${value}`)
    .join(';')
  return declarations ? `${declarations};` : ''
}
