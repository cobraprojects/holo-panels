import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { Direction } from 'radix-ui'
import { createPanelTranslator, type PanelTranslator } from '@holo-js/panels-client'

const PanelLocaleContext = createContext<Readonly<{ locale: string, direction: 'ltr' | 'rtl' }>>({ locale: 'en', direction: 'ltr' })

export function PanelsLocaleProvider({ children, direction = 'ltr', locale }: { readonly children: ReactNode, readonly direction?: 'ltr' | 'rtl', readonly locale: string }): ReactNode {
  const value = useMemo(() => ({ direction, locale }), [direction, locale])
  return <PanelLocaleContext.Provider value={value}><Direction.Provider dir={direction}>{children}</Direction.Provider></PanelLocaleContext.Provider>
}

export function usePanelLocale(): string {
  return useContext(PanelLocaleContext).locale
}

export function usePanelDirection(): 'ltr' | 'rtl' {
  return useContext(PanelLocaleContext).direction
}

export function usePanelTranslator(locale?: string): PanelTranslator {
  const inherited = usePanelLocale()
  return useMemo(() => createPanelTranslator(locale ?? inherited), [inherited, locale])
}
