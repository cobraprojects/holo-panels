import { describe, expect, it, vi } from 'vitest'
import { field, schema } from '@holo-js/forms'
import {
  createTemporaryUploadService,
  defineUploadPolicy,
  handleUploadEndpoint,
  UploadFieldBuilder,
  UploadStoragePaginationError,
  uploadFields,
  type MediaAttachmentTarget,
  type UploadPolicy,
  type UploadStorageAdapter,
} from '../src/fields/upload'
import { FormSchemaBinding } from '../src/fields/base'
import { validateFormFields } from '../src/fields/validation'
import { executeGeneratedUploadOperation } from '../src/resources/generated-pages'

vi.mock('@holo-js/authorization', () => ({
  forUser: () => ({ authorize: async () => undefined }),
}))

class MemoryUploadStorage implements UploadStorageAdapter {
  readonly bytes = new Map<string, Uint8Array>()
  readonly json = new Map<string, unknown>()

  async delete(path: string): Promise<void> {
    this.bytes.delete(path)
    this.json.delete(path)
  }

  async list(directory: string, request: { readonly cursor: string | null, readonly limit: number }) {
    const paths = [...new Set([...this.bytes.keys(), ...this.json.keys()])]
      .filter(path => path.startsWith(`${directory}/`))
      .sort()
    const start = request.cursor === null ? 0 : Math.max(0, paths.findIndex(path => path > request.cursor!))
    const page = paths.slice(start, start + request.limit)
    return {
      nextCursor: start + request.limit < paths.length ? page.at(-1) ?? null : null,
      paths: page,
    }
  }

  async getBytes(path: string): Promise<Uint8Array | null> {
    return this.bytes.get(path) ?? null
  }

  async getJson<TValue>(path: string): Promise<TValue | null> {
    return this.json.get(path) as TValue | undefined ?? null
  }

  async put(path: string, contents: Uint8Array): Promise<void> {
    this.bytes.set(path, new Uint8Array(contents))
  }

  async putJson(path: string, value: unknown): Promise<void> {
    this.json.set(path, structuredClone(value))
  }

  async temporaryUrl(path: string, expiresInSeconds: number): Promise<string | null> {
    return `https://private.test/${path}?expires=${expiresInSeconds}`
  }
}

const policy: UploadPolicy = {
  acceptedExtensions: ['png'],
  acceptedMimeTypes: ['image/png'],
  conversions: ['thumbnail'],
  directory: 'panels/uploads',
  disk: 'local',
  expiresInSeconds: 300,
  imageOnly: true,
  maximumFiles: 2,
  maximumSize: 1024,
  private: true,
}

const context = {
  actorId: 'actor-1',
  fieldId: 'avatar',
  panelId: 'admin',
  resourceId: 'users',
  sessionId: 'upload-session-1',
  tenantId: 'tenant-1',
} as const

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function service(storage: MemoryUploadStorage, overrides: Partial<UploadPolicy> = {}) {
  let id = 0
  return createTemporaryUploadService({
    authorize: () => true,
    createId: () => `upload-${++id}`,
    createToken: () => `secure-token-${'x'.repeat(32)}-${id}`,
    policy: { ...policy, ...overrides },
    storage,
  })
}

describe('temporary upload security and Holo integration', () => {
  it('binds upload fields only to public Holo file schema definitions', () => {
    const form = schema({ avatar: field.file().required(), title: field.string() })
    const definition = uploadFields(form).file('avatar', policy).label('Avatar').compile()

    expect(definition).toMatchObject({
      path: 'avatar',
      required: true,
      type: 'panels:field:upload',
      properties: { uploadPolicy: { disk: 'local', maximumFiles: 2 } },
    })
    const binding = new FormSchemaBinding(form)
    expect(() => new UploadFieldBuilder(binding.bind('title'), policy).compile()).toThrow(/file field/)
  })

  it('executes the temporary handshake behind a CSRF-verified framework endpoint boundary', async () => {
    const uploads = service(new MemoryUploadStorage())
    await expect(handleUploadEndpoint(uploads, {
      body: { action: 'create', declaredMimeType: 'image/png', name: 'avatar.png', sessionId: context.sessionId, size: png.length },
      context,
      csrfVerified: false,
    })).rejects.toThrow(/CSRF/)
    const created = await handleUploadEndpoint(uploads, {
      body: { action: 'create', declaredMimeType: 'image/png', name: 'avatar.png', sessionId: context.sessionId, size: png.length },
      context,
      csrfVerified: true,
    })
    if (!('token' in created)) throw new Error('Expected a temporary upload descriptor')
    const stored = await handleUploadEndpoint(uploads, {
      body: { action: 'write', contents: png, id: created.id, sessionId: context.sessionId, token: created.token },
      context,
      csrfVerified: true,
    })
    expect(stored).toMatchObject({ id: created.id, state: 'stored' })
    const definition = uploadFields(schema({ avatar: field.file().required() })).file('avatar', policy).compile()
    expect(await validateFormFields([definition], { avatar: stored })).toEqual({})
    expect(await validateFormFields([definition], { avatar: null })).toEqual({ avatar: ['This field is required.'] })
  })

  it('executes generated upload requests only for registered resource upload fields', async () => {
    const storage = new MemoryUploadStorage()
    const resource = {
      form: { fields: [{ path: 'avatar', properties: { uploadPolicy: policy }, type: 'panels:field:upload' }] },
      id: 'users',
      kind: 'resource',
      model: {
        definition: { name: 'User' },
        query: () => ({ first: async () => undefined }),
      },
      nested: null,
      shared: true,
      singular: null,
    }
    const generatedContext = {
      actor: { id: 'actor-1' },
      signal: new AbortController().signal,
      tenant: 'tenant-1',
      uploadStorage: storage,
    }
    const created = await executeGeneratedUploadOperation(resource, {
      context: generatedContext,
      panelId: 'admin',
      payload: { action: 'create', declaredMimeType: 'image/png', fieldId: 'avatar', name: 'avatar.png', resourceId: 'users', sessionId: context.sessionId, size: png.length },
    })
    expect(created).toMatchObject({ id: expect.any(String), state: 'pending', token: expect.any(String) })
    if (typeof created.id !== 'string' || typeof created.token !== 'string') throw new Error('Expected generated upload credentials')
    await expect(executeGeneratedUploadOperation(resource, {
      contents: png,
      context: generatedContext,
      panelId: 'admin',
      payload: { action: 'write', fieldId: 'avatar', id: created.id, resourceId: 'users', sessionId: context.sessionId, token: created.token },
    })).resolves.toMatchObject({ id: created.id, state: 'stored' })
    await expect(executeGeneratedUploadOperation(resource, {
      context: generatedContext,
      panelId: 'admin',
      payload: { action: 'create', declaredMimeType: 'image/png', fieldId: 'missing', name: 'avatar.png', resourceId: 'users', sessionId: context.sessionId, size: png.length },
    })).rejects.toThrow(/not registered/)
  })

  it('rejects unsafe policy paths, oversized declarations, and spoofed MIME content', async () => {
    expect(() => defineUploadPolicy({ ...policy, directory: '../outside' })).toThrow(/safe relative path/)
    const uploads = service(new MemoryUploadStorage())
    await expect(uploads.create({ ...context, declaredMimeType: 'image/png', name: 'avatar.png', size: 2048 }))
      .rejects.toThrow(/size/)
    const descriptor = await uploads.create({ ...context, declaredMimeType: 'image/png', name: 'avatar.png', size: 8 })
    await expect(uploads.write({
      ...context,
      contents: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0, 0, 0, 0]),
      id: descriptor.id,
      token: descriptor.token,
    })).rejects.toThrow(/MIME type/)
  })

  it('stores private previews and rejects cross-tenant access and unauthorized deletion', async () => {
    const storage = new MemoryUploadStorage()
    const uploads = service(storage)
    const descriptor = await uploads.create({ ...context, declaredMimeType: 'image/png', name: 'avatar.png', size: png.length })
    const stored = await uploads.write({ ...context, contents: png, id: descriptor.id, token: descriptor.token })

    expect(stored.previewUrl).toMatch(/^https:\/\/private\.test\//)
    await expect(uploads.resolve({ ...context, tenantId: 'tenant-2', id: descriptor.id, token: descriptor.token }))
      .rejects.toThrow(/scope/)
    await expect(uploads.delete({ ...context, id: descriptor.id, token: 'wrong-token-value-that-is-long-enough' }))
      .rejects.toThrow(/token/)
    expect(storage.bytes.size).toBe(1)
  })

  it('stores uploads on disks that do not support temporary preview URLs', async () => {
    const storage = new MemoryUploadStorage()
    vi.spyOn(storage, 'temporaryUrl').mockResolvedValue(null)
    const uploads = service(storage)
    const descriptor = await uploads.create({ ...context, declaredMimeType: 'image/png', name: 'avatar.png', size: png.length })

    const stored = await uploads.write({ ...context, contents: png, id: descriptor.id, token: descriptor.token })
    expect(stored.state).toBe('stored')
    expect(stored).not.toHaveProperty('previewUrl')
    expect(storage.bytes.has('panels/uploads/temporary/upload-1.png')).toBe(true)
  })

  it('re-authorizes deletion on the server before touching Holo Storage', async () => {
    const storage = new MemoryUploadStorage()
    const uploads = createTemporaryUploadService({
      authorize: request => request.operation !== 'delete',
      createId: () => 'upload-protected',
      createToken: () => `secure-token-${'x'.repeat(32)}`,
      policy,
      storage,
    })
    const descriptor = await uploads.create({ ...context, declaredMimeType: 'image/png', name: 'avatar.png', size: png.length })
    await uploads.write({ ...context, contents: png, id: descriptor.id, token: descriptor.token })

    await expect(uploads.delete({ ...context, id: descriptor.id, token: descriptor.token }))
      .rejects.toThrow(/not authorized/)
    expect(storage.bytes.size).toBe(1)
  })

  it('serializes concurrent session creation against maximum file count', async () => {
    const uploads = service(new MemoryUploadStorage(), { maximumFiles: 1 })
    const requests = [1, 2].map(index => uploads.create({
      ...context,
      declaredMimeType: 'image/png',
      name: `avatar-${index}.png`,
      size: png.length,
    }))
    const results = await Promise.allSettled(requests)
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1)
  })

  it('does not let an abandoned upload block a new form session', async () => {
    const uploads = service(new MemoryUploadStorage(), { maximumFiles: 1 })
    await uploads.create({ ...context, declaredMimeType: 'image/png', name: 'abandoned.png', size: png.length })

    await expect(uploads.create({
      ...context,
      declaredMimeType: 'image/png',
      name: 'replacement.png',
      sessionId: 'upload-session-2',
      size: png.length,
    })).resolves.toMatchObject({ name: 'replacement.png', sessionId: 'upload-session-2' })
  })

  it('attaches stored bytes through the public Holo Media shape and removes temporary data', async () => {
    const storage = new MemoryUploadStorage()
    const uploads = service(storage)
    const descriptor = await uploads.create({ ...context, declaredMimeType: 'image/png', name: 'avatar.png', size: png.length })
    await uploads.write({ ...context, contents: png, id: descriptor.id, token: descriptor.token })
    const toMediaCollection = vi.fn(async () => ({
      data: { uuid: 'media-1', getUrl: (conversion?: string) => `https://media.test/${conversion ?? 'original'}.png` },
      error: null,
    }))
    const target: MediaAttachmentTarget = {
      addMedia: source => ({
        usingFileName: fileName => {
          expect(fileName).toBe('avatar.png')
          expect(source.contents).toEqual(png)
          return { usingFileName: () => { throw new Error('unreachable') }, toMediaCollection }
        },
        toMediaCollection,
      }),
    }

    await expect(uploads.attachToMedia({ ...context, id: descriptor.id, token: descriptor.token }, target, 'avatars'))
      .resolves.toEqual({
        id: 'media-1',
        url: 'https://media.test/thumbnail.png',
        urls: {
          original: 'https://media.test/original.png',
          thumbnail: 'https://media.test/thumbnail.png',
        },
      })
    expect(toMediaCollection).toHaveBeenCalledWith('avatars')
    expect(storage.bytes.size).toBe(0)
    expect(storage.json.size).toBe(0)
  })

  it('finalizes a stored upload to its configured disk and removes temporary state', async () => {
    const storage = new MemoryUploadStorage()
    const uploads = service(storage)
    const descriptor = await uploads.create({ ...context, declaredMimeType: 'image/png', name: 'avatar.png', size: png.length })
    await uploads.write({ ...context, contents: png, id: descriptor.id, token: descriptor.token })

    await expect(uploads.finalizeToStorage({ ...context, id: descriptor.id, token: descriptor.token })).resolves.toEqual({
      disk: 'local',
      mimeType: 'image/png',
      name: 'avatar.png',
      path: 'panels/uploads/upload-1.png',
      size: png.length,
    })
    expect(storage.bytes).toEqual(new Map([['panels/uploads/upload-1.png', png]]))
    expect(storage.json.size).toBe(0)
  })

  it('retains temporary state when permanent storage rejects finalization', async () => {
    const storage = new MemoryUploadStorage()
    const uploads = service(storage)
    const descriptor = await uploads.create({ ...context, declaredMimeType: 'image/png', name: 'avatar.png', size: png.length })
    await uploads.write({ ...context, contents: png, id: descriptor.id, token: descriptor.token })
    vi.spyOn(storage, 'put').mockRejectedValueOnce(new Error('permanent storage unavailable'))

    await expect(uploads.finalizeToStorage({ ...context, id: descriptor.id, token: descriptor.token }))
      .rejects.toThrow('permanent storage unavailable')
    expect(storage.bytes.has('panels/uploads/temporary/upload-1.png')).toBe(true)
    expect(storage.json.has('panels/uploads/temporary/upload-1.json')).toBe(true)
  })

  it('cleans abandoned temporary uploads after the documented expiry', async () => {
    const storage = new MemoryUploadStorage()
    let now = new Date('2026-07-27T12:00:00.000Z')
    const uploads = createTemporaryUploadService({
      authorize: () => true,
      createId: () => 'upload-expired',
      createToken: () => `secure-token-${'x'.repeat(32)}`,
      now: () => now,
      policy,
      storage,
    })
    await uploads.create({ ...context, declaredMimeType: 'image/png', name: 'avatar.png', size: png.length })
    now = new Date('2026-07-27T12:06:00.000Z')
    await expect(uploads.cleanupExpired()).resolves.toBe(1)
    expect(storage.json.size).toBe(0)
  })

  it('traverses bounded cleanup pages and validates each page before deletion', async () => {
    const storage = new MemoryUploadStorage()
    const expiredAt = '2026-07-27T11:00:00.000Z'
    for (let index = 0; index < 101; index += 1) {
      const id = `upload-${String(index).padStart(3, '0')}`
      const metadataPath = `panels/uploads/temporary/${id}.json`
      storage.json.set(metadataPath, {
        ...context,
        dataPath: `panels/uploads/temporary/${id}.png`,
        expiresAt: expiredAt,
        id,
        metadataPath,
      })
    }
    const list = vi.spyOn(storage, 'list')
    await expect(service(storage).cleanupExpired()).resolves.toBe(101)
    expect(list).toHaveBeenCalledTimes(2)

    const malformed = new MemoryUploadStorage()
    const deleteFile = vi.spyOn(malformed, 'delete')
    vi.spyOn(malformed, 'list').mockResolvedValue({ nextCursor: null, paths: ['outside/upload.json'] })
    await expect(service(malformed).cleanupExpired()).rejects.toBeInstanceOf(UploadStoragePaginationError)
    expect(deleteFile).not.toHaveBeenCalled()
  })

  it('stops active upload counting when the configured maximum is reached', async () => {
    const storage = new MemoryUploadStorage()
    for (const id of ['a', 'b']) {
      const metadataPath = `panels/uploads/temporary/${id}.json`
      storage.json.set(metadataPath, {
        ...context,
        dataPath: `panels/uploads/temporary/${id}.png`,
        expiresAt: '2099-01-01T00:00:00.000Z',
        id,
        metadataPath,
      })
    }
    for (let index = 0; index < 120; index += 1) {
      storage.json.set(`panels/uploads/temporary/z-${index}.json`, { ...context, actorId: 'another-actor' })
    }
    const list = vi.spyOn(storage, 'list')
    await expect(service(storage, { maximumFiles: 2 }).create({
      ...context,
      declaredMimeType: 'image/png',
      name: 'third.png',
      size: png.length,
    })).rejects.toThrow('Upload count exceeds')
    expect(list).toHaveBeenCalledTimes(1)
  })
})
