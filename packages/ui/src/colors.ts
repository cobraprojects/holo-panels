export const panelSemanticColorNames = [
  'primary',
  'success',
  'warning',
  'danger',
  'info',
] as const

export type PanelSemanticColorName = (typeof panelSemanticColorNames)[number]

export interface PanelColorAppearance {
  readonly attribute: string | undefined
  readonly custom: string | undefined
}

const semanticColorNames = new Set<string>(panelSemanticColorNames)

function safePanelColor(value: string): string | undefined {
  const color = value.trim()
  const hasUnsafeCharacter = [...color].some(character =>
    ';{}<>'.includes(character)
    || character.charCodeAt(0) <= 31
    || character.charCodeAt(0) === 127,
  )
  return color
    && color.length <= 256
    && !hasUnsafeCharacter
    && !/\/\*|\*\/|(?:expression|url)\s*\(|@import|<\/style/iu.test(color)
    ? color
    : undefined
}

export function panelColorAppearance(value: string | null | undefined): PanelColorAppearance {
  if (!value) return { attribute: undefined, custom: undefined }
  const color = safePanelColor(value)
  if (!color) return { attribute: undefined, custom: undefined }
  const normalized = color.toLowerCase()
  return semanticColorNames.has(normalized)
    ? { attribute: normalized, custom: undefined }
    : { attribute: color, custom: color }
}
