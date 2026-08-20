import { panelThemeVariables } from '@holo-js/panels-react'

export interface NextPanelAuthAppearance {
  readonly colors?: Readonly<Record<string, string>>
  readonly density?: 'comfortable' | 'compact'
  readonly fontFamily?: string | null
  readonly monoFontFamily?: string | null
  readonly serifFontFamily?: string | null
  readonly tokens?: Readonly<Record<string, string>>
}

export function nextPanelAuthAppearanceVariables(
  appearance?: NextPanelAuthAppearance,
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
