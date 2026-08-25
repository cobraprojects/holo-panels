import {
  CollectionStore,
  FormStore,
  type JsonValue,
  OptionStore,
  type OptionValue,
  UploadStore,
  type ClientUploadFile,
  type StoredUploadDescriptor,
  type TemporaryUploadDescriptor,
} from '@holo-js/panels-client'
import { defaultSlugTransform } from '@holo-js/panels-core'
import type {
  FormAcceptanceFixture,
  FormAcceptanceJourneyReport,
  FormAcceptanceOperation,
} from './contracts'

interface Deferred<TValue> {
  readonly promise: Promise<TValue>
  resolve(value: TValue): void
}

function deferred<TValue>(): Deferred<TValue> {
  let resolvePromise: ((value: TValue) => void) | undefined
  const promise = new Promise<TValue>(resolve => {
    resolvePromise = resolve
  })
  return {
    promise,
    resolve: value => {
      if (!resolvePromise) throw new Error('Deferred acceptance operation is unavailable')
      resolvePromise(value)
    },
  }
}

function imageFile(name: string): ClientUploadFile {
  const bytes = new TextEncoder().encode(name)
  return {
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    name,
    size: bytes.byteLength,
    type: 'image/png',
  }
}

function temporaryUpload(id: string, file: Pick<ClientUploadFile, 'name' | 'size' | 'type'>): TemporaryUploadDescriptor {
  return {
    declaredMimeType: file.type,
    expiresAt: '2030-01-01T00:00:00.000Z',
    extension: 'png',
    fieldId: 'images',
    id,
    name: file.name,
    panelId: 'admin',
    resourceId: 'posts',
    sessionId: 'acceptance-upload-session',
    size: file.size,
    state: 'pending',
    tenantId: 'tenant',
    token: `token-${id}`,
  }
}

function storedUpload(upload: TemporaryUploadDescriptor): StoredUploadDescriptor {
  const { token: _token, ...descriptor } = upload
  return {
    ...descriptor,
    detectedMimeType: 'image/png',
    previewUrl: `/previews/${upload.name}`,
    state: 'stored',
  }
}

async function waitForUploads(store: UploadStore): Promise<void> {
  if (store.state.pending === 0) return
  await new Promise<void>(resolve => {
    const unsubscribe = store.subscribe(state => {
      if (state.pending !== 0) return
      unsubscribe()
      resolve()
    })
  })
}

function createForm(operation: FormAcceptanceOperation): FormStore<Record<string, unknown>> {
  const initial: Record<string, unknown> = operation === 'create'
    ? { city: null, country: 'eg', images: [], sections: [{ heading: '' }, { heading: '' }], slug: '', title: '' }
    : { city: 20, country: 'eg', images: [], sections: [{ heading: 'Intro' }, { heading: '' }], slug: 'existing-post', title: 'Existing post' }
  return new FormStore(initial, {
    dependencies: [{
      id: 'title-to-slug',
      paths: ['title'],
      recompute: context => {
        const title = context.get('title')
        if (typeof title !== 'string') throw new Error('Acceptance title is not a string')
        return [{ kind: 'set', path: 'slug', value: defaultSlugTransform(title) }]
      },
    }],
  })
}

function stringValue(store: FormStore<Record<string, unknown>>, path: string): string {
  const value = store.state.values[path]
  if (typeof value !== 'string') throw new Error(`Acceptance value "${path}" is not a string`)
  return value
}

async function waitForProgress(store: UploadStore, name: string, progress: number): Promise<void> {
  if (store.state.items.some(item => item.name === name && item.progress === progress)) return
  await new Promise<void>(resolve => {
    const unsubscribe = store.subscribe(state => {
      if (!state.items.some(item => item.name === name && item.progress === progress)) return
      unsubscribe()
      resolve()
    })
  })
}

export async function runFormAcceptanceJourney(fixture: FormAcceptanceFixture): Promise<FormAcceptanceJourneyReport> {
  const createFormStore = createForm('create')
  createFormStore.set('title', 'Cairo Travel Guide')
  const editFormStore = createForm('edit')
  editFormStore.set('title', 'Updated Nile Guide')

  const cityPage = deferred<{
    readonly hasMore: boolean
    readonly options: readonly { readonly label: string, readonly value: number }[]
    readonly page: number
    readonly perPage: number
  }>()
  const cityStore = new OptionStore<OptionValue>({
    dependencies: { country: 'eg' },
    fieldId: 'city',
    locale: 'en',
    panelId: 'admin',
    requiredDependencies: ['country'],
    resourceId: 'posts',
    tenantKey: 'tenant',
    transport: {
      hydrateSelected: async (_request, values) => values.map(value => ({ label: `City ${value}`, value })),
      list: request => cityPage.promise.then(page => ({ ...page, page: request.page, perPage: request.perPage })),
      validateSelection: async () => false,
    },
  })
  const cityLoad = cityStore.preload()
  const observedLoading = cityStore.state.loading
  const renderReports = [await fixture.render({
    cityOptions: cityStore,
    form: editFormStore,
    operation: 'edit',
    sections: new CollectionStore<JsonValue>([], 'section'),
    stage: 'city-loading',
    uploads: new UploadStore({
      adapter: {
        create: async () => { throw new Error('Loading fixture does not create uploads') },
        delete: async () => undefined,
        deleteExisting: async () => undefined,
        resolve: async () => { throw new Error('Loading fixture does not resolve uploads') },
        write: async () => { throw new Error('Loading fixture does not write uploads') },
      },
      context: { actorId: 'editor', fieldId: 'images', panelId: 'admin', resourceId: 'posts', tenantId: 'tenant' },
      policy: {
        acceptedExtensions: ['png'], acceptedMimeTypes: ['image/png'], directory: 'acceptance', disk: 'private',
        expiresInSeconds: 600, imageOnly: true, maximumFiles: 4, maximumSize: 10_000, private: true,
      },
    }),
  })]
  cityPage.resolve({ hasMore: false, options: [{ label: 'Cairo', value: 20 }, { label: 'Giza', value: 21 }], page: 1, perPage: 25 })
  await cityLoad
  const loadedLabels = cityStore.state.options.map(option => option.label)
  editFormStore.set('country', 'us')
  const selectedCity = editFormStore.state.values.city
  if (selectedCity !== null && typeof selectedCity !== 'string' && typeof selectedCity !== 'number') {
    throw new Error('Acceptance city has an unsupported option value')
  }
  const dependencyUpdate = await cityStore.updateDependencies({ country: 'us' }, selectedCity)
  if (dependencyUpdate.status === 'cleared') editFormStore.set('city', null)

  const sectionValues = editFormStore.state.values.sections
  if (!Array.isArray(sectionValues)) throw new Error('Acceptance sections are unavailable')
  const sections = new CollectionStore<JsonValue>(sectionValues as readonly JsonValue[], 'section')
  sections.setErrors({ '1': 'Section contains an error', '1.heading': 'Heading is required' })
  sections.delete(0)
  editFormStore.batch([
    { kind: 'errors', path: 'sections', errors: ['Section 1 heading is required'] },
    { kind: 'errors', path: 'sections.0.heading', errors: sections.state.errors['0.heading'] ?? [] },
  ])

  let uploadSequence = 0
  const uploadGates = new Map<string, Deferred<void>>()
  const removedNames: string[] = []
  const observedProgress: number[] = []
  const uploads = new UploadStore({
    adapter: {
      create: async (_context, file) => {
        const upload = temporaryUpload(`upload-${++uploadSequence}`, file)
        uploadGates.set(upload.id, deferred<void>())
        return upload
      },
      delete: async (_context, id) => {
        const item = uploads.state.items.find(candidate => candidate.id === id)
        if (item) removedNames.push(item.name)
      },
      deleteExisting: async () => undefined,
      resolve: async (_context, id, token) => storedUpload(temporaryUpload(id, { name: `${token}.png`, size: 1, type: 'image/png' })),
      write: async (_context, upload, _contents, _signal, onProgress) => {
        onProgress(0.25)
        observedProgress.push(0.25)
        const gate = uploadGates.get(upload.id)
        if (!gate) throw new Error(`Upload gate for "${upload.id}" is unavailable`)
        await gate.promise
        onProgress(1)
        observedProgress.push(1)
        return storedUpload(upload)
      },
    },
    context: { actorId: 'editor', fieldId: 'images', panelId: 'admin', resourceId: 'posts', tenantId: 'tenant' },
    maximumConcurrency: 1,
    policy: {
      acceptedExtensions: ['png'],
      acceptedMimeTypes: ['image/png'],
      directory: 'acceptance',
      disk: 'private',
      expiresInSeconds: 600,
      imageOnly: true,
      maximumFiles: 4,
      maximumSize: 10_000,
      private: true,
    },
  })
  uploads.add([imageFile('cover.png'), imageFile('map.png')])
  await waitForProgress(uploads, 'cover.png', 0.25)
  renderReports.push(await fixture.render({ cityOptions: cityStore, form: editFormStore, operation: 'edit', sections, stage: 'upload-progress', uploads }))
  uploadGates.get('upload-1')?.resolve()
  await waitForProgress(uploads, 'map.png', 0.25)
  uploadGates.get('upload-2')?.resolve()
  await waitForUploads(uploads)
  uploads.reorder(1, 0)
  const previewUrls = uploads.state.items.flatMap(item => item.previewUrl ? [item.previewUrl] : [])
  const orderedNames = uploads.state.items.map(item => item.name)
  renderReports.push(await fixture.render({ cityOptions: cityStore, form: editFormStore, operation: 'edit', sections, stage: 'upload-reordered', uploads }))
  const removeTarget = uploads.state.items[1]
  if (!removeTarget) throw new Error('Upload acceptance item is missing')
  await uploads.remove(removeTarget.id)
  renderReports.push(await fixture.render({ cityOptions: cityStore, form: editFormStore, operation: 'edit', sections, stage: 'upload-removed', uploads }))
  renderReports.push(await fixture.render({ cityOptions: cityStore, form: createFormStore, operation: 'create', sections, stage: 'create', uploads }))
  renderReports.push(await fixture.render({ cityOptions: cityStore, form: editFormStore, operation: 'edit', sections, stage: 'edit', uploads }))

  return {
    city: {
      clearedAfterCountryChange: editFormStore.state.values.city === null,
      loadedLabels,
      observedLoading,
    },
    framework: fixture.framework,
    renderReports,
    repeater: {
      errorPathsAfterRemoval: Object.keys(sections.state.errors).filter(path => path.includes('.')),
      stableKeys: sections.state.items.map(item => item.key),
    },
    slug: {
      create: stringValue(createFormStore, 'slug'),
      edit: stringValue(editFormStore, 'slug'),
    },
    upload: {
      observedProgress,
      orderedNames,
      previewUrls,
      removedNames,
    },
  }
}
