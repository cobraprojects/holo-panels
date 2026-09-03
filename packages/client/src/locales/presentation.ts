import type { LocaleDirection, PanelTranslationKey, PanelTranslator } from '@holo-js/panels-core'

export { createPanelTranslator } from '@holo-js/panels-core'
export type { PanelTranslationKey, PanelTranslator } from '@holo-js/panels-core'

export function syncDocumentLocale(
  state: { readonly direction: LocaleDirection, readonly locale: string },
  document: Pick<Document, 'documentElement'>,
): () => void {
  const previousLanguage = document.documentElement.lang
  const previousDirection = document.documentElement.dir
  document.documentElement.lang = state.locale
  document.documentElement.dir = state.direction
  return () => {
    document.documentElement.lang = previousLanguage
    document.documentElement.dir = previousDirection
  }
}

const filterOperatorKeys = {
  '=': 'filters.operator.equal',
  '!=': 'filters.operator.notEqual',
  '>': 'filters.operator.greater',
  '>=': 'filters.operator.atLeast',
  '<': 'filters.operator.less',
  '<=': 'filters.operator.atMost',
  'like': 'filters.operator.contains',
  'in': 'filters.operator.in',
  'not-in': 'filters.operator.notIn',
  'between': 'filters.operator.between',
  'null': 'filters.operator.empty',
  'not-null': 'filters.operator.notEmpty',
} satisfies Record<string, PanelTranslationKey>

export function translateFilterOperator(operator: string, translate: PanelTranslator): string {
  return Object.hasOwn(filterOperatorKeys, operator) ? translate(filterOperatorKeys[operator as keyof typeof filterOperatorKeys]) : operator
}
