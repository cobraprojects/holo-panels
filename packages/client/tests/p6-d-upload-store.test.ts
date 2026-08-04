import type { StoredUploadDescriptor, TemporaryUploadDescriptor, UploadActorContext } from '@holo-js/panels-core'
import { describe, expect, it, vi } from 'vitest'
import { createUploadStore, type ClientUploadFile, type UploadClientAdapter } from '../src/uploads'

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
})
