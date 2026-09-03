import { describe, expect, it, vi } from 'vitest'
import {
  arCatalog,
  createTranslationReference,
  defineTranslationCatalog,
  enCatalog,
  trans,
  TranslationCatalogRegistry,
} from '@holo-js/panels-core'
import { createPanelTranslator, LocaleManager, resolvePanelLocale, syncDocumentLocale } from '../src/locales'

describe('client locales', () => {
  it('resolves requested, actor, panel, application, and fallback locales in order', () => {
    const resolved = resolvePanelLocale({
      requestedLocale: 'fr-CA',
      actorLocale: 'ar-EG',
      panelLocale: 'fr',
      applicationLocale: 'en-GB',
      fallbackLocale: 'en',
    }, ['ar', 'en', 'fr'])

    expect(resolved).toEqual({ locale: 'fr', fallbackLocales: ['fr', 'ar', 'en'] })
  })

  it('switches locale, exposes RTL metadata, interpolates, and pluralizes', () => {
    const manager = new LocaleManager(new TranslationCatalogRegistry({ defaults: [enCatalog, arCatalog] }), {
      requestedLocale: 'en',
      fallbackLocale: 'en',
    })

    expect(manager.state.direction).toBe('ltr')
    expect(manager.translate(trans('pagination.summary', { from: 1, to: 10, total: 12 }))).toBe('Showing 1 to 10 of 12')
    expect(manager.translate(trans('records.selected', { count: 2 }))).toBe('2 records selected')

    expect(manager.setLocale('ar').direction).toBe('rtl')
    expect(manager.translate(trans('records.selected', { count: 0 }))).toBe('لم يتم تحديد أي سجلات')
    expect(manager.translate(trans('records.selected', { count: 3 }))).toBe('تم تحديد 3 سجلات')
    expect(manager.translate(trans('actions.save'))).toBe(arCatalog.messages['actions.save'])
    expect(manager.setLocale('EN').direction).toBe('ltr')
    expect(manager.translate(trans('actions.save'))).toBe(enCatalog.messages['actions.save'])
  })

  it('uses locale fallback before reporting a missing key', () => {
    const french = defineTranslationCatalog('fr', 'ltr', { 'actions.save': 'Enregistrer' })
    const diagnostic = vi.fn()
    const manager = new LocaleManager(new TranslationCatalogRegistry({ defaults: [enCatalog, french] }), {
      requestedLocale: 'fr',
      fallbackLocale: 'en',
      development: true,
      onDiagnostic: diagnostic,
    })

    expect(manager.translate(trans('actions.save'))).toBe('Enregistrer')
    expect(manager.translate(trans('actions.cancel'))).toBe('Cancel')
    expect(diagnostic).not.toHaveBeenCalled()
  })

  it('emits development diagnostics without exposing missing keys', () => {
    const reference = createTranslationReference<'plugin.missing', string>('plugin.missing')
    const diagnostic = vi.fn()
    const registry = new TranslationCatalogRegistry({ defaults: [enCatalog] })
    const development = new LocaleManager(registry, {
      requestedLocale: 'en',
      fallbackLocale: 'en',
      development: true,
      onDiagnostic: diagnostic,
    })
    const production = new LocaleManager(registry, { requestedLocale: 'en', fallbackLocale: 'en' })

    expect(development.translate(reference)).toBe('')
    expect(diagnostic).toHaveBeenCalledWith({
      attemptedLocales: ['en'],
      code: 'missing-translation',
      key: 'plugin.missing',
      locale: 'en',
    })
    expect(production.translate(reference)).toBe('')
  })

  it('ships complete English and Arabic panel chrome translations', () => {
    const english = createPanelTranslator('en')
    const arabic = createPanelTranslator('ar')

    expect(english('auth.signIn')).toBe('Sign in')
    expect(arabic('auth.signIn')).toBe('تسجيل الدخول')
    expect(english('notifications.empty')).toBe('No notifications')
    expect(arabic('notifications.empty')).toBe('لا توجد إشعارات')
    expect(arabic('search.placeholder')).not.toContain('search.')
    expect(createPanelTranslator('fr')('auth.signIn')).toBe('Sign in')
  })

  it('updates document language and direction and restores the previous values', () => {
    const root = { dir: '', lang: '' } as HTMLElement
    const document = { documentElement: root }
    root.lang = 'fr'
    root.dir = 'ltr'

    const restore = syncDocumentLocale({ direction: 'rtl', locale: 'ar' }, document)

    expect(root.lang).toBe('ar')
    expect(root.dir).toBe('rtl')
    restore()
    expect(root.lang).toBe('fr')
    expect(root.dir).toBe('ltr')
  })
})
