import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  isClusterDefinition,
  isDiscoverableBuilder,
  isDiscoverableDefinition,
  isExportDefinition,
  isImportDefinition,
  isPageDefinition,
  isPanelDefinition,
  isPluginDefinition,
  isRelationManagerDefinition,
  isResourceDefinition,
  isWidgetDefinition,
  markDiscoverableDefinition,
} from '../src/discovery/markers'
import { DISCOVERY_MARKER } from '../src/discovery/types'
import { createHoloUploadStorage } from '../src/fields/upload/storage'

const storageRuntime = vi.hoisted(() => {
  const disk = {
    delete: vi.fn(async () => undefined),
    listFiles: vi.fn(async () => ({ nextCursor: null, paths: ['temporary/upload.bin'] })),
    getBytes: vi.fn(async () => new Uint8Array([1, 2, 3])),
    json: vi.fn(async () => ({ state: 'pending' })),
    put: vi.fn(async () => true),
    putJson: vi.fn(async () => true),
    temporaryUrl: vi.fn(async () => 'https://storage.test/temporary/upload.bin'),
  }
  return {
    disk,
    resolveDisk: vi.fn(() => disk),
  }
})

vi.mock('@holo-js/storage/runtime', () => ({
  Storage: { disk: storageRuntime.resolveDisk },
}))

describe('Holo upload storage adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storageRuntime.disk.put.mockResolvedValue(true)
    storageRuntime.disk.putJson.mockResolvedValue(true)
  })

  it('lazily resolves one named disk and delegates every storage operation', async () => {
    const storage = createHoloUploadStorage('private')
    const bytes = new Uint8Array([7, 8])

    await expect(storage.list('temporary', { cursor: null, limit: 100 })).resolves.toEqual({ nextCursor: null, paths: ['temporary/upload.bin'] })
    await expect(storage.getBytes('temporary/upload.bin')).resolves.toEqual(new Uint8Array([1, 2, 3]))
    await expect(storage.getJson<{ state: string }>('temporary/upload.json')).resolves.toEqual({ state: 'pending' })
    await storage.put('temporary/new.bin', bytes)
    await storage.putJson('temporary/new.json', { state: 'stored' })
    await expect(storage.temporaryUrl('temporary/upload.bin', 90)).resolves.toBe(
      'https://storage.test/temporary/upload.bin',
    )
    await storage.delete('temporary/upload.bin')

    expect(storageRuntime.resolveDisk).toHaveBeenCalledTimes(1)
    expect(storageRuntime.resolveDisk).toHaveBeenCalledWith('private')
    expect(storageRuntime.disk.put).toHaveBeenCalledWith('temporary/new.bin', bytes)
    expect(storageRuntime.disk.putJson).toHaveBeenCalledWith('temporary/new.json', { state: 'stored' })
    expect(storageRuntime.disk.temporaryUrl).toHaveBeenCalledWith('temporary/upload.bin', { expiresIn: 90 })
    expect(storageRuntime.disk.delete).toHaveBeenCalledWith('temporary/upload.bin')
  })

  it('fails closed when Holo Storage rejects byte or metadata writes', async () => {
    const storage = createHoloUploadStorage('private')
    storageRuntime.disk.put.mockResolvedValueOnce(false)
    storageRuntime.disk.putJson.mockResolvedValueOnce(false)

    await expect(storage.put('temporary/rejected.bin', new Uint8Array())).rejects.toThrow(
      'Holo Storage rejected the temporary upload write',
    )
    await expect(storage.putJson('temporary/rejected.json', {})).rejects.toThrow(
      'Holo Storage rejected the temporary upload metadata write',
    )
  })
})

describe('discovery definition validation', () => {
  const definition = {
    client: { label: 'Posts' },
    componentKeys: ['posts.table'],
    default: true,
    discover: { pages: 'pages', resources: 'resources' },
    discoveryMarker: DISCOVERY_MARKER,
    id: 'posts',
    kind: 'resource',
    navigationKeys: ['posts'],
    panelId: 'admin',
    permissionKeys: ['posts.view'],
    route: '/posts',
  } as const

  it('accepts complete definitions and rejects malformed boundary values', () => {
    expect(isDiscoverableDefinition(definition)).toBe(true)
    for (const invalid of [
      null,
      [],
      { ...definition, discoveryMarker: 'forged' },
      { ...definition, kind: 'unknown' },
      { ...definition, id: '' },
      { ...definition, panelId: 1 },
      { ...definition, permissionKeys: ['valid', ''] },
      { ...definition, componentKeys: [1] },
      { ...definition, navigationKeys: 'posts' },
      { ...definition, default: 'yes' },
      { ...definition, client: [] },
      { ...definition, discover: { pages: 1 } },
    ]) {
      expect(isDiscoverableDefinition(invalid)).toBe(false)
    }
  })

  it('recognizes builders and every kind-specific definition guard', () => {
    expect(isDiscoverableBuilder({
      compileDiscoveryDefinition: () => definition,
      discoveryMarker: DISCOVERY_MARKER,
      id: 'posts',
      kind: 'resource',
    })).toBe(true)
    expect(isDiscoverableBuilder({ ...definition, compileDiscoveryDefinition: 'not-a-function' })).toBe(false)

    expect(isPanelDefinition({ ...definition, kind: 'panel' })).toBe(true)
    expect(isResourceDefinition({ ...definition, kind: 'resource' })).toBe(true)
    expect(isPageDefinition({ ...definition, kind: 'page' })).toBe(true)
    expect(isWidgetDefinition({ ...definition, kind: 'widget' })).toBe(true)
    expect(isClusterDefinition({ ...definition, kind: 'cluster' })).toBe(true)
    expect(isRelationManagerDefinition({ ...definition, kind: 'relation-manager' })).toBe(true)
    expect(isPluginDefinition({ ...definition, kind: 'plugin' })).toBe(true)
    expect(isImportDefinition({ ...definition, kind: 'import' })).toBe(true)
    expect(isExportDefinition({ ...definition, kind: 'export' })).toBe(true)
    expect(isPanelDefinition(definition)).toBe(false)
  })

  it('marks and freezes author definitions without mutating the input', () => {
    const input = { id: 'admin', kind: 'panel' as const }
    const marked = markDiscoverableDefinition(input)

    expect(marked).toEqual({ ...input, discoveryMarker: DISCOVERY_MARKER })
    expect(marked).not.toBe(input)
    expect(Object.isFrozen(marked)).toBe(true)
    expect(input).not.toHaveProperty('discoveryMarker')
  })
})
