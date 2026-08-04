import { describe, expect, expectTypeOf, it } from 'vitest'
import { assertPluginCompatible } from '../src/plugins/compatibility'
import { DuplicateRegistrationError, ExtensionRegistry } from '../src/plugins/registry'
import { createExtensionTypeId } from '../src/plugins/type-id'

const compatibility = {
  panels: { maximumExclusive: '2.0.0', minimum: '1.0.0' },
  protocol: { maximumExclusive: '2.0', minimum: '1.0' },
}

const renderer = {
  name: 'text',
  namespace: 'acme.crm',
  typeId: 'acme.crm:field:text',
}

describe('extension registries', () => {
  it('registers custom fields and columns without central registry changes', () => {
    const registry = new ExtensionRegistry()
    const fieldId = createExtensionTypeId('acme.crm', 'field', 'money')
    const columnId = createExtensionTypeId('acme.crm', 'column', 'money')
    const field = registry.register({
      compatibility,
      kind: 'field',
      pluginId: 'acme.crm',
      renderer,
      state: { currency: 'USD' as const, precision: 2 },
      typeId: fieldId,
    })

    registry.register({
      compatibility,
      kind: 'column',
      pluginId: 'acme.crm',
      renderer,
      typeId: columnId,
    })

    expectTypeOf(field.state).toEqualTypeOf<{ currency: 'USD'; precision: number } | undefined>()
    expect(registry.get(fieldId)).toBe(field)
    expect(registry.get(columnId)?.kind).toBe('column')
  })

  it('rejects duplicate registrations deterministically', () => {
    const registry = new ExtensionRegistry()
    const typeId = createExtensionTypeId('acme.crm', 'field', 'money')
    const registration = { compatibility, kind: 'field' as const, pluginId: 'acme.crm', typeId }
    registry.register(registration)

    expect(() => registry.register(registration)).toThrow(
      new DuplicateRegistrationError('acme.crm:field:money'),
    )
  })

  it('permits only explicit panel-scoped renderer overrides', () => {
    const registry = new ExtensionRegistry()
    const typeId = createExtensionTypeId('acme.crm', 'field', 'money')
    registry.register({ compatibility, kind: 'field', pluginId: 'acme.crm', typeId })
    registry.overrideRenderer('admin', typeId, renderer)

    expect(registry.renderer(typeId, 'admin')).toBe(renderer)
    expect(() => registry.renderer(typeId)).toThrow(/No renderer is registered/)
    expect(() => registry.overrideRenderer('admin', typeId, renderer)).toThrow(
      /already registered for panel admin/,
    )
  })

  it('rejects invalid namespaces and mismatched registration kinds', () => {
    expect(() => createExtensionTypeId('@acme', 'field', 'money')).toThrow(/Invalid extension namespace/)

    const registry = new ExtensionRegistry()
    const typeId = createExtensionTypeId('acme', 'field', 'money')
    expect(() => registry.register({
      compatibility,
      kind: 'column',
      pluginId: 'acme',
      typeId,
    })).toThrow(/does not match/)
  })
})

describe('plugin compatibility', () => {
  it('accepts compatible panel and protocol versions', () => {
    expect(() => assertPluginCompatible('acme.crm', compatibility, {
      panels: '1.4.2',
      protocol: '1.7',
    })).not.toThrow()
  })

  it('accepts prerelease versions whose core version satisfies the minimum', () => {
    expect(() => assertPluginCompatible('acme.crm', {
      panels: { minimum: '0.0.0' },
      protocol: { minimum: '1.0' },
    }, {
      panels: '0.1.0-next.0',
      protocol: '1.0',
    })).not.toThrow()
  })

  it.each([
    [{ panels: '2.0.0', protocol: '1.0' }, 'panels'],
    [{ panels: '1.4.2', protocol: '2.0' }, 'protocol'],
  ])('rejects incompatible registrations deterministically', (actual, target) => {
    expect(() => assertPluginCompatible('acme.crm', compatibility, actual)).toThrow(
      new RegExp(`acme.crm requires Holo Panels ${target}`),
    )
  })
})
