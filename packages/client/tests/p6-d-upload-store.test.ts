import type { StoredUploadDescriptor, TemporaryUploadDescriptor, UploadActorContext } from '@holo-js/panels-core'
import { describe, expect, it, vi } from 'vitest'
import { createBrowserUploadAdapter, createUploadStore, type ClientUploadFile, type UploadClientAdapter } from '../src/uploads'
import { PROTOCOL_VERSION, TRANSPORT_REQUEST_FIELD } from '@holo-js/panels-core'

const context: UploadActorContext = {
  actorId: 'actor-1',
  fieldId: 'avatar',
  panelId: 'admin',
  resourceId: 'users',
}

const policy = {
  acceptedExtensions: ['png'],
  acceptedMimeTypes: ['image/png'],
  directory: 'panels/uploads',
  disk: 'local',
  expiresInSeconds: 300,
  imageOnly: true,
  maximumFiles: 3,
  maximumSize: 1024,
  private: true,
} as const

function file(name: string): ClientUploadFile {
  const contents = new Uint8Array([0x89, 0x50, 0x4e, 0x47])
  return {
    name,
    size: contents.length,
    type: 'image/png',
    async arrayBuffer() { return contents.buffer },
  }
}

function adapter(): UploadClientAdapter {
  let sequence = 0
  return {
    async create(scope, input): Promise<TemporaryUploadDescriptor> {
      sequence += 1
      return {
        declaredMimeType: input.type,
        expiresAt: '2026-07-27T12:05:00.000Z',
        extension: 'png',
        fieldId: scope.fieldId,
        id: `upload-${sequence}`,
        name: input.name,
        panelId: scope.panelId,
        resourceId: scope.resourceId,
        sessionId: 'upload-session-1',
        size: input.size,
        state: 'pending',
        token: `token-${sequence}`,
      }
    },
    async delete(): Promise<void> {},
    async deleteExisting(): Promise<void> {},
    async resolve(): Promise<StoredUploadDescriptor> { throw new Error('not used') },
    async write(scope, upload, contents, signal, onProgress): Promise<StoredUploadDescriptor> {
      expect(signal.aborted).toBe(false)
      expect(contents.byteLength).toBe(upload.size)
      onProgress(0.5)
      return {
        declaredMimeType: upload.declaredMimeType,
        detectedMimeType: upload.declaredMimeType,
        expiresAt: upload.expiresAt,
        extension: upload.extension,
        fieldId: scope.fieldId,
        id: upload.id,
        name: upload.name,
        panelId: scope.panelId,
        previewUrl: `https://private.test/${upload.id}`,
        resourceId: scope.resourceId,
        sessionId: upload.sessionId,
        size: upload.size,
        state: 'stored',
      }
    },
  }
}

async function settled(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 0))
  await new Promise(resolve => setTimeout(resolve, 0))
}

describe('upload client store', () => {
  it('hydrates existing media, queues concurrent writes, tracks progress, and reorders', async () => {
    const store = createUploadStore({
      adapter: adapter(),
      context,
      existing: [{ id: 'media-1', mimeType: 'image/png', name: 'existing.png', size: 10 }],
      maximumConcurrency: 1,
      policy,
    })
    store.add([file('first.png'), file('second.png')])
    await settled()

    expect(store.state.items.map(item => item.status)).toEqual(['existing', 'stored', 'stored'])
    expect(store.state.items[1]).toMatchObject({ progress: 1, previewUrl: 'https://private.test/upload-1' })
    store.reorder(2, 0)
    expect(store.state.items.map(item => item.name)).toEqual(['second.png', 'existing.png', 'first.png'])
  })

  it('rejects invalid client files and delegates authorized temporary deletion', async () => {
    const transport = adapter()
    const remove = vi.spyOn(transport, 'delete')
    const store = createUploadStore({ adapter: transport, context, policy })
    expect(() => store.add([{ ...file('unsafe.exe'), type: 'application/octet-stream' }])).toThrow(/extension/)
    store.add([file('avatar.png')])
    await settled()
    await store.remove('upload-1')

    expect(remove).toHaveBeenCalledWith(context, 'upload-1', 'token-1', expect.any(AbortSignal))
    expect(store.state.items).toEqual([])
  })

  it('keeps replacement uploads queued until cancelled work releases its concurrency slot', async () => {
    const starts: string[] = []
    let concurrent = 0
    let maximumConcurrent = 0
    const transport = adapter()
    transport.create = async (_context, upload, signal) => {
      starts.push(upload.name)
      concurrent += 1
      maximumConcurrent = Math.max(maximumConcurrent, concurrent)
      try {
        await new Promise<void>((resolve, reject) => {
          const onAbort = (): void => reject(Object.assign(new Error('cancelled'), { name: 'AbortError' }))
          signal.addEventListener('abort', onAbort, { once: true })
          setTimeout(resolve, 0)
        })
      } finally {
        concurrent -= 1
      }
      return await adapter().create(_context, upload, signal)
    }
    const store = createUploadStore({ adapter: transport, context, maximumConcurrency: 1, policy })

    store.add([file('obsolete.png')])
    expect(starts).toEqual(['obsolete.png'])
    store.reset()
    store.add([file('replacement.png')])
    expect(starts).toEqual(['obsolete.png'])

    await settled()
    expect(starts).toEqual(['obsolete.png', 'replacement.png'])
    expect(maximumConcurrent).toBe(1)
    expect(store.state.items).toEqual([expect.objectContaining({ name: 'replacement.png', status: 'stored' })])
  })

  it('sends binary upload contents as multipart data to the fixed panel route', async () => {
    const send = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      expect(_url).toBe('/holo/panels/admin/upload')
      expect(init?.body).toBeInstanceOf(FormData)
      const body = init?.body as FormData
      expect(body.get('_token')).toBe('csrf-token')
      const request = JSON.parse(String(body.get(TRANSPORT_REQUEST_FIELD))) as { readonly id: string, readonly payload: Record<string, unknown> }
      expect(request.payload).toMatchObject({ action: 'write', fieldId: 'avatar', intent: 'edit', recordId: 'user-1', resourceId: 'users', sessionId: expect.any(String) })
      const contents = body.get('contents')
      expect(contents).toBeInstanceOf(Blob)
      expect((contents as Blob).size).toBe(4)
      return new Response(JSON.stringify({
        data: {
          declaredMimeType: 'image/png',
          detectedMimeType: 'image/png',
          expiresAt: '2026-07-27T12:05:00.000Z',
          extension: 'png',
          fieldId: 'avatar',
          id: 'upload-1',
          name: 'avatar.png',
          panelId: 'admin',
          resourceId: 'users',
          sessionId: request.payload.sessionId,
          size: 4,
          state: 'stored',
        },
        effects: [],
        id: request.id,
        ok: true,
        protocolVersion: PROTOCOL_VERSION,
      }), { status: 200 })
    })
    const transport = createBrowserUploadAdapter({
      csrfProvider: { getField: () => ({ name: '_token', value: 'csrf-token' }) },
      endpoint: '/holo/panels/admin/upload',
      fieldId: 'avatar',
      intent: 'edit',
      panelId: 'admin',
      recordId: 'user-1',
      resourceId: 'users',
    })
    const temporary = { ...(await adapter().create(context, file('avatar.png'), new AbortController().signal)), id: 'upload-1' }
    await expect(transport.write(context, temporary, new Uint8Array([1, 2, 3, 4]), new AbortController().signal, () => undefined))
      .resolves.toMatchObject({ id: 'upload-1', state: 'stored' })
    expect(send).toHaveBeenCalledOnce()
  })
})
