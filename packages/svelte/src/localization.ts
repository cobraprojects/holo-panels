import { getContext, setContext } from 'svelte'
import { createPanelTranslator, type PanelTranslator } from '@holo-js/panels-client'

const panelLocale = Symbol('panels-locale')
const panelDirection = Symbol('panels-direction')

export function providePanelsLocale(locale: () => string, direction: () => 'ltr' | 'rtl' = () => 'ltr'): void {
  setContext(panelLocale, locale)
  setContext(panelDirection, direction)
}

export function usePanelLocale(): () => string {
  return getContext<(() => string) | undefined>(panelLocale) ?? (() => 'en')
}

export function usePanelDirection(): () => 'ltr' | 'rtl' {
  return getContext<(() => 'ltr' | 'rtl') | undefined>(panelDirection) ?? (() => 'ltr')
}

export function usePanelTranslator(override?: () => string | undefined): PanelTranslator {
  const inherited = usePanelLocale()
  let locale: string | undefined
  let translate: PanelTranslator
  return (key, replacements) => {
    const next = override?.() ?? inherited()
    if (next !== locale) {
      locale = next
      translate = createPanelTranslator(next)
    }
    return translate(key, replacements)
  }
}
