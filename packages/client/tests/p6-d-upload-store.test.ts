import type { StoredUploadDescriptor, TemporaryUploadDescriptor, UploadActorContext } from '@holo-js/panels-core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bindUploadStore, createBrowserUploadAdapter, createUploadStore, uploadFormPatch, type ClientUploadFile, type UploadClientAdapter } from '../src/uploads'
import { FormStore } from '../src/forms'
import { PROTOCOL_VERSION, TRANSPORT_REQUEST_FIELD } from '@holo-js/panels-core'

const context: UploadActorContext = {
  actorId: 'actor-1',
  fieldId: 'avatar',
  panelId: 'admin',
  resourceId: 'users',
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

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
  it('reports policy rejection in the active locale without starting an upload', () => {
    const transport = adapter()
    const create = vi.spyOn(transport, 'create')
    const store = createUploadStore({ adapter: transport, context, locale: 'ar', policy })
    expect(store.add([file('unsafe.exe')])).toEqual([])
    expect(store.state.error).toBe('امتداد الملف غير مسموح به')
    expect(store.state.items).toEqual([])
    expect(create).not.toHaveBeenCalled()
    store.setLocale('en')
    store.add([file('unsafe.exe')])
    expect(store.state.error).toBe('File extension is not allowed')
  })

  it('keeps upload failures, pending work, completion, and removal in the resource form', async () => {
    const form = new FormStore<{ avatar: unknown }>({ avatar: '' })
    const store = createUploadStore({ adapter: adapter(), context, policy })
    const release = bindUploadStore(form, 'avatar', store, false)
    store.add([file('invalid.exe')])
    expect(form.state.errors.avatar).toEqual(['File extension is not allowed'])
    store.add([file('avatar.png')])
    expect(form.state.pending.avatar).toBe(true)
    expect((await form.submit(async () => { throw new Error('Pending uploads must not submit') })).status).toBe('invalid')
    await settled()
    expect(form.get('avatar')).toEqual({ id: 'upload-1', sessionId: 'upload-session-1', token: 'token-1' })
    expect(form.state.pending.avatar).toBe(false)
    expect(form.state.errors.avatar).toBeUndefined()
    await store.remove('upload-1')
    expect(form.get('avatar')).toBe('')
    release()
  })
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

  it('hydrates persisted paths and stages their removal until the resource is saved', async () => {
    const form = new FormStore({ avatar: 'panels/uploads/original.png' })
    const store = createUploadStore({
      adapter: createBrowserUploadAdapter({ endpoint: '/upload', fieldId: 'avatar', intent: 'edit', panelId: 'admin', resourceId: 'users' }),
      context,
      policy,
    })
    const release = bindUploadStore(form, 'avatar', store, false)
    expect(store.state.items).toEqual([expect.objectContaining({ name: 'original.png', status: 'existing' })])
    expect(form.state.dirtyPaths).toEqual([])
    await store.remove('panels/uploads/original.png')
    expect(form.get('avatar')).toBe('')
    form.reset()
    expect(store.state.items).toEqual([expect.objectContaining({ name: 'original.png', status: 'existing' })])
    release()
  })

  it('replaces consumed upload tokens with saved paths so the edit form can be saved again', async () => {
    const form = new FormStore<{ avatar: unknown }>({ avatar: '' })
    const store = createUploadStore({ adapter: adapter(), context, policy })
    const release = bindUploadStore(form, 'avatar', store, false)
    store.add([file('avatar.png')])
    await settled()
    await form.submit(async request => ({
      commitValues: true,
      ...uploadFormPatch(form, request.values, { avatar: 'panels/uploads/saved.png' }, [{ path: 'avatar', type: 'panels:field:upload' }]),
    }))
    expect(form.get('avatar')).toBe('panels/uploads/saved.png')
    expect(store.state.items).toEqual([expect.objectContaining({ name: 'saved.png', status: 'existing' })])
    await form.submit(async request => {
      expect(request.values.avatar).toBe('panels/uploads/saved.png')
      return { commitValues: true }
    })
    release()
  })

  it('commits saved upload paths without discarding edits made while saving', async () => {
    const form = new FormStore<{ avatar: unknown, title: string }>({ avatar: '', title: 'Submitted title' })
    const transport = adapter()
    const removeTemporary = vi.spyOn(transport, 'delete')
    const store = createUploadStore({ adapter: transport, context, policy })
    const release = bindUploadStore(form, 'avatar', store, false)
    store.add([file('avatar.png')])
    await settled()
    let finish: (() => void) | undefined
    const saved = new Promise<void>(resolve => { finish = resolve })
    const submission = form.submit(async request => {
      await saved
      return {
        commitValues: true,
        ...uploadFormPatch(form, request.values, { avatar: 'panels/uploads/saved.png' }, [{ path: 'avatar', type: 'panels:field:upload' }]),
      }
    })
    await settled()
    form.set('title', 'Unsaved title', { touch: true })
    finish?.()
    await submission
    expect(form.state.initialValues).toEqual({ avatar: 'panels/uploads/saved.png', title: 'Submitted title' })
    expect(form.state.values).toEqual({ avatar: 'panels/uploads/saved.png', title: 'Unsaved title' })
    expect(form.state.dirtyPaths).toEqual(['title'])
    expect(store.state.items).toEqual([expect.objectContaining({ id: 'panels/uploads/saved.png', status: 'existing' })])
    await store.remove('panels/uploads/saved.png')
    expect(removeTemporary).not.toHaveBeenCalled()
    form.resetField('avatar')
    expect(store.state.items).toEqual([expect.objectContaining({ id: 'panels/uploads/saved.png', status: 'existing' })])
    expect(form.get('title')).toBe('Unsaved title')
    release()
  })

  it('restores existing media when only its field is reset', async () => {
    const form = new FormStore({ avatar: 'panels/uploads/original.png', title: 'Original title' })
    const store = createUploadStore({ adapter: adapter(), context, policy })
    const release = bindUploadStore(form, 'avatar', store, false)
    form.set('title', 'Unsaved title', { touch: true })
    await store.remove('panels/uploads/original.png')
    form.resetField('avatar')
    expect(store.state.items).toEqual([expect.objectContaining({ id: 'panels/uploads/original.png', status: 'existing' })])
    expect(form.get('title')).toBe('Unsaved title')
    release()
  })

  it('uploads multiple files and reconciles saved items without cancelling newer uploads', async () => {
    const form = new FormStore<{ photos: unknown[] }>({ photos: [] })
    const transport = adapter()
    const store = createUploadStore({ adapter: transport, context, policy })
    const release = bindUploadStore(form, 'photos', store, true)
    store.add([file('first.png')])
    await settled()
    expect(store.state.items[0]?.status).toBe('stored')
    let finish: (() => void) | undefined
    const saved = new Promise<void>(resolve => { finish = resolve })
    const submission = form.submit(async request => {
      await saved
      return { commitValues: true, ...uploadFormPatch(form, request.values, { photos: ['panels/uploads/first.png'] }, [{ path: 'photos', type: 'panels:field:upload' }]) }
    })
    await settled()
    let finishWrite: (() => void) | undefined
    const written = new Promise<void>(resolve => { finishWrite = resolve })
    const write = transport.write
    transport.write = async (...args) => { await written; return await write(...args) }
    store.add([file('second.png')])
    await settled()
    finish?.()
    await submission
    expect(form.state.initialValues.photos).toEqual(['panels/uploads/first.png'])
    expect(store.state.items.map(item => item.status)).toEqual(['existing', 'uploading'])
    expect(form.state.pending.photos).toBe(true)
    finishWrite?.()
    await settled()
    store.reorder(1, 0)
    expect(form.get('photos')).toEqual([{ id: 'upload-2', sessionId: 'upload-session-1', token: 'token-2' }, 'panels/uploads/first.png'])
    form.reset()
    expect(store.state.items).toEqual([expect.objectContaining({ id: 'panels/uploads/first.png', status: 'existing' })])
    release()
  })

  it('keeps replacements made during saving while committing the finalized upload baseline', async () => {
    const form = new FormStore<{ avatar: unknown }>({ avatar: '' })
    const store = createUploadStore({ adapter: adapter(), context, policy })
    const release = bindUploadStore(form, 'avatar', store, false)
    store.add([file('first.png')])
    await settled()
    let finish: (() => void) | undefined
    const saved = new Promise<void>(resolve => { finish = resolve })
    const submission = form.submit(async request => {
      await saved
      return { commitValues: true, ...uploadFormPatch(form, request.values, { avatar: 'panels/uploads/first.png' }, [{ path: 'avatar', type: 'panels:field:upload' }]) }
    })
    await settled()
    await store.remove('upload-1')
    store.add([file('second.png')])
    await settled()
    finish?.()
    await submission
    expect(form.get('avatar')).toEqual({ id: 'upload-2', sessionId: 'upload-session-1', token: 'token-2' })
    expect(form.state.initialValues.avatar).toBe('panels/uploads/first.png')
    form.reset()
    expect(store.state.items).toEqual([expect.objectContaining({ id: 'panels/uploads/first.png', status: 'existing' })])
    release()
  })

  it('rejects invalid client files and delegates authorized temporary deletion', async () => {
    const transport = adapter()
    const remove = vi.spyOn(transport, 'delete')
    const store = createUploadStore({ adapter: transport, context, policy })
    expect(store.add([{ ...file('unsafe.exe'), type: 'application/octet-stream' }])).toEqual([])
    expect(store.state.error).toMatch(/extension/)
    store.add([file('avatar.png')])
    await settled()
    expect(store.state.error).toBeNull()
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

  it('cancels an unfinished upload when the form resets before its value changes', async () => {
    const transport = adapter()
    transport.create = async (_context, _file, signal) => await new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true })
    })
    const store = createUploadStore({ adapter: transport, context, policy })
    const form = new FormStore({ avatar: '' })
    const release = bindUploadStore(form, 'avatar', store, false)
    store.add([file('pending.png')])
    form.reset()
    expect(store.state.items).toEqual([])
    expect(form.state.pending.avatar).toBe(false)
    release()
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

  it('reports transferred bytes before a browser upload completes', async () => {
    const progress: number[] = []
    class BrowserRequest {
      responseType = ''
      response: unknown
      onload: (() => void) | null = null
      upload: { onprogress: ((event: { lengthComputable: boolean, loaded: number, total: number }) => void) | null } = { onprogress: null }
      open(): void {}
      send(body: FormData): void {
        const request = JSON.parse(String(body.get(TRANSPORT_REQUEST_FIELD))) as { id: string }
        this.upload.onprogress?.({ lengthComputable: true, loaded: 2, total: 4 })
        this.response = { data: { id: 'upload-1', name: 'avatar.png', size: 4 }, effects: [], id: request.id, ok: true, protocolVersion: PROTOCOL_VERSION }
        this.onload?.()
      }
    }
    vi.stubGlobal('XMLHttpRequest', BrowserRequest)
    const transport = createBrowserUploadAdapter({ csrfProvider: { getField: () => ({ name: '_token', value: 'csrf' }) }, endpoint: '/upload', fieldId: 'avatar', intent: 'create', panelId: 'admin', resourceId: 'users' })
    const temporary = await adapter().create(context, file('avatar.png'), new AbortController().signal)
    await transport.write(context, temporary, new Uint8Array([1, 2, 3, 4]), new AbortController().signal, value => progress.push(value))
    expect(progress).toEqual([0, 0.5, 1])
  })

  it('discards a cancelled handshake even when the transport completes late', async () => {
    const transport = adapter()
    let finish: (() => void) | undefined
    const create = transport.create
    const written: string[] = []
    transport.create = async (...args) => {
      await new Promise<void>(resolve => { finish = resolve })
      return create(...args)
    }
    const write = transport.write
    transport.write = async (...args) => {
      written.push(args[1].name)
      return write(...args)
    }
    const store = createUploadStore({ adapter: transport, context, policy })
    const [id] = store.add([file('cancelled.png')])
    await store.remove(id!)
    finish?.()
    await settled()
    expect(written).toEqual([])
    expect(store.state).toMatchObject({ items: [], pending: 0 })
  })

  it('renders a deletion failure and allows retrying the authorized removal', async () => {
    const transport = adapter()
    let allowed = false
    transport.delete = async () => {
      if (!allowed) throw new Error('Removal denied')
    }
    const store = createUploadStore({ adapter: transport, context, policy })
    store.add([file('avatar.png')])
    await settled()
    await store.remove('upload-1')
    expect(store.state.items[0]).toMatchObject({ error: 'Removal denied' })
    allowed = true
    await store.remove('upload-1')
    expect(store.state.items).toEqual([])
  })
})
