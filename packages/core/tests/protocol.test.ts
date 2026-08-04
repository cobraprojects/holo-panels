import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  PROTOCOL_VERSION,
  ProtocolCompatibilityError,
  assertJsonSafe,
  assertProtocolCompatible,
  exposeSourceLocation,
  serializeManifest,
  toJsonValue,
  type JsonValue,
  type PanelNode,
  type PublicNode,
} from '../src/index'

const jsonValue = fc.letrec<{ value: JsonValue }>(tie => ({
  value: fc.oneof(
    { depthSize: 'small' },
    fc.boolean(),
    fc.constant(null),
    fc.double({ noDefaultInfinity: true, noNaN: true }),
    fc.string(),
    fc.array(tie('value'), { maxLength: 4 }),
    fc.dictionary(fc.string(), tie('value'), { maxKeys: 4 }),
  ),
})).value

describe('protocol compatibility', () => {
  it('accepts older minor versions within the same major version', () => {
    expect(() => assertProtocolCompatible('1.0', '1.2')).not.toThrow()
  })

  it('reports expected and actual incompatible versions', () => {
    expect(() => assertProtocolCompatible('2.0', '1.3')).toThrow(
      new ProtocolCompatibilityError('1.3', '2.0'),
    )
  })
})

describe('manifest serialization', () => {
  it('round-trips every supported generated JSON value', () => {
    fc.assert(fc.property(jsonValue, value => {
      const normalized = toJsonValue(value)
      expect(JSON.parse(serializeManifest(value))).toEqual(normalized)
      expect(toJsonValue(normalized)).toEqual(normalized)
    }))
  })

  it('serializes a protocol fixture identically on repeated runs', () => {
    const panel: PanelNode = {
      id: 'admin',
      kind: 'panel',
      properties: { path: '/admin', title: 'Administration' },
      protocolVersion: PROTOCOL_VERSION,
      type: 'core:panel',
    }

    expect(serializeManifest(panel)).toBe(serializeManifest(panel))
    expect(serializeManifest({ z: 1, a: 2 })).toBe('{"a":2,"z":1}')
  })

  it.each([
    ['callback', { callback: () => true }],
    ['symbol', { value: Symbol('private') }],
    ['model instance', new (class Model { id = '1' })()],
    ['date', new Date()],
    ['unsafe redirect', { url: 'javascript:alert(1)' }],
    ['protocol-relative redirect', { url: '//attacker.example' }],
    ['credential-bearing URL', { url: 'https://user:secret@example.com' }],
  ])('rejects %s values', (_name, value) => {
    expect(() => serializeManifest(value)).toThrow(/not JSON-safe/)
  })

  it('rejects callbacks placed inside an otherwise valid public node', () => {
    const node = {
      id: 'users',
      kind: 'resource',
      properties: { model: 'User' },
      protocolVersion: PROTOCOL_VERSION,
      server: { resolve: () => [] },
      type: 'core:resource',
    }

    expect(() => assertJsonSafe(node)).toThrow(/function values are unsupported/)
  })

  it('allows safe relative and HTTPS URLs', () => {
    expect(toJsonValue({ href: '/users', url: 'https://example.com/file' })).toEqual({
      href: '/users',
      url: 'https://example.com/file',
    })
  })
})

describe('protocol nodes and source locations', () => {
  it('narrows nodes by their kind discriminator', () => {
    const getRoute = (node: PublicNode): string | null => {
      if (node.kind === 'page') {
        return node.properties.route
      }

      return null
    }

    expect(getRoute({
      id: 'users.index',
      kind: 'page',
      properties: { route: '/users' },
      protocolVersion: PROTOCOL_VERSION,
      type: 'core:page',
    })).toBe('/users')
  })

  it('removes local paths from production diagnostics', () => {
    const source = {
      column: 4,
      exportName: 'UsersResource',
      line: 12,
      projectPath: 'app/panels/resources/users.ts',
    }

    expect(exposeSourceLocation(source, 'development')).toEqual(source)
    expect(exposeSourceLocation(source, 'production')).toEqual({
      exportName: 'UsersResource',
    })
  })
})
