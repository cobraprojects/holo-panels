import { defineComponent, h, inject, provide, type InjectionKey, type PropType } from 'vue'
import { ConfigProvider } from 'reka-ui'
import { createPanelTranslator, type PanelTranslator } from '@holo-js/panels-client'

const panelLocale: InjectionKey<() => string> = Symbol('panels-locale')
const panelDirection: InjectionKey<() => 'ltr' | 'rtl'> = Symbol('panels-direction')

export const PanelsLocaleProvider = defineComponent({
  name: 'PanelsLocaleProvider',
  props: {
    locale: { type: String, required: true },
    direction: { type: String as PropType<'ltr' | 'rtl'>, default: 'ltr' },
  },
  setup(props, { slots }) {
    providePanelsLocale(() => props.locale, () => props.direction)
    return () => h(ConfigProvider, { dir: props.direction, locale: props.locale }, slots)
  },
})

export function providePanelsLocale(locale: () => string, direction: () => 'ltr' | 'rtl' = () => 'ltr'): void {
  provide(panelLocale, locale)
  provide(panelDirection, direction)
}

export function usePanelLocale(): () => string {
  return inject(panelLocale, () => 'en')
}

export function usePanelDirection(): () => 'ltr' | 'rtl' {
  return inject(panelDirection, () => 'ltr')
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
