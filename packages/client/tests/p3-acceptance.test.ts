import {
  applySchemaNodePatches,
  callout,
  defineSchema,
  enCatalog,
  grid,
  patchSchemaNode,
  ServerResolverBatcher,
  trans,
  TranslationCatalogRegistry,
  type ServerResolverRequest,
} from '@holo-js/panels-core'
import { describe, expect, it } from 'vitest'
import { LocaleManager } from '../src/locales'

describe('P3 framework-neutral acceptance', () => {
  it('combines deterministic schemas, dependency patches, and locale switching', async () => {
    const compileFixture = () => defineSchema('profile').components([
      grid([
        callout().key('status').heading('Account status'),
      ]).key('layout').columns({ default: 1, md: 2 }),
    ]).compile()
    const original = compileFixture()
    const repeated = compileFixture()

    expect(repeated).toEqual(original)

    const locallyPatched = patchSchemaNode(original, 'profile.layout.status', {
      properties: { heading: 'Updated locally' },
    })
    expect(locallyPatched).not.toBe(original)
    expect(original.components[0]?.children[0]?.properties.heading).toBe('Account status')

    let enabled = false
    const request: ServerResolverRequest = {
      target: 'profile.layout.status',
      resolverId: 'profile.status-visibility',
      explicitDependencies: [],
      async run(observe): Promise<boolean> {
        observe('enabled')
        return enabled
      },
    }
    const batcher = new ServerResolverBatcher()
    const hidden = await batcher.resolve({ scope: 'profile', version: 1, requests: [request] })
    enabled = true
    const visible = await batcher.resolve({ scope: 'profile', version: 2, requests: [request] })

    expect(hidden.patches[0]).toMatchObject({ dependencies: ['enabled'], value: false })
    expect(visible.patches[0]).toMatchObject({ dependencies: ['enabled'], value: true })

    const serverPatched = applySchemaNodePatches(locallyPatched, visible.patches.map(patch => ({
      id: patch.target,
      changes: { visible: patch.value === true },
    })))
    expect(serverPatched.components[0]?.children[0]).toMatchObject({
      visible: true,
      properties: { heading: 'Updated locally' },
    })

    const locale = new LocaleManager(new TranslationCatalogRegistry({ defaults: [enCatalog] }), {
      requestedLocale: 'en',
      fallbackLocale: 'en',
    })
    expect(locale.translate(trans('actions.save'))).toBe('Save')
    expect(locale.setLocale('en-US')).toMatchObject({ locale: 'en', direction: 'ltr' })
    expect(compileFixture()).toEqual(original)
  })
})
