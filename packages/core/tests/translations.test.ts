import { describe, expect, it } from 'vitest'
import {
  arCatalog,
  assertUntranslatedStableKey,
  defineTranslationCatalog,
  enCatalog,
  isTranslationReference,
  trans,
  TranslationCatalogRegistry,
} from '../src/translations'

declare module '../src/translations/contracts' {
  interface RegisteredTranslations {
    readonly 'plugin.welcome': 'Welcome {name}'
  }
}

describe('translation contracts', () => {
  it('creates frozen references with replacement values inferred from messages', () => {
    const staticReference = trans('actions.save')
    const interpolatedReference = trans('pagination.summary', { from: 1, to: 10, total: 42 })
    const pluralReference = trans('records.selected', { count: 2 })
    const pluginReference = trans('plugin.welcome', { name: 'Mona' })

    expect(staticReference).toEqual({ kind: 'translation', key: 'actions.save', replacements: {} })
    expect(interpolatedReference.replacements).toEqual({ from: 1, to: 10, total: 42 })
    expect(pluralReference.replacements).toEqual({ count: 2 })
    expect(pluginReference.replacements).toEqual({ name: 'Mona' })
    expect(isTranslationReference(interpolatedReference)).toBe(true)
    expect(isTranslationReference({ kind: 'translation', key: 'unsafe', replacements: { value: {} } })).toBe(false)
    expect(Object.isFrozen(interpolatedReference)).toBe(true)
    expect(Object.isFrozen(interpolatedReference.replacements)).toBe(true)
  })

  it('rejects translations where stable IDs or permission keys are required', () => {
    expect(() => assertUntranslatedStableKey(trans('actions.save'), 'stable ID')).toThrow('non-translated')
    expect(() => assertUntranslatedStableKey('', 'permission key')).toThrow('non-translated')
    expect(() => assertUntranslatedStableKey('posts.update', 'permission key')).not.toThrow()
  })

  it('applies deterministic application and plugin override priority', () => {
    const firstPlugin = defineTranslationCatalog('en', 'ltr', { 'actions.save': 'Store' })
    const secondPlugin = defineTranslationCatalog('en', 'ltr', { 'actions.save': 'Persist' })
    const application = defineTranslationCatalog('en', 'ltr', { 'actions.save': 'Apply' })
    const registry = new TranslationCatalogRegistry({
      defaults: [enCatalog, arCatalog],
      plugins: [
        { id: 'first', catalogs: [firstPlugin] },
        { id: 'second', catalogs: [secondPlugin] },
      ],
      application: [application],
    })

    expect(registry.lookup(['en'], 'actions.save')).toMatchObject({ message: 'Apply', source: 'application' })
    expect(registry.lookup(['ar'], 'actions.save')).toMatchObject({ message: 'حفظ', source: 'default' })
    expect(registry.availableLocales).toEqual(['ar', 'en'])
  })

  it('rejects ambiguous catalog and plugin registration', () => {
    expect(() => new TranslationCatalogRegistry({ defaults: [enCatalog, enCatalog] })).toThrow('Duplicate default')
    expect(() => new TranslationCatalogRegistry({
      defaults: [enCatalog],
      plugins: [{ id: 'same', catalogs: [] }, { id: 'same', catalogs: [] }],
    })).toThrow('duplicate translation plugin ID')
    expect(() => new TranslationCatalogRegistry({
      defaults: [enCatalog],
      application: [defineTranslationCatalog('en', 'rtl', { 'actions.save': 'Save' })],
    })).toThrow('Conflicting translation directions')
  })
})
