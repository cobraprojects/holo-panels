import type { FormOperation, FormPath, FormServerPatch, FormStore } from '../forms'
import { getPathValue, pathsOverlap } from '../forms/paths'
import type { UploadStore } from './store'

type UploadFormValue = string | { readonly id: string, readonly sessionId: string, readonly token: string }

function isTemporaryUpload(value: unknown): value is Exclude<UploadFormValue, string> {
  return typeof value === 'object' && value !== null && 'id' in value && typeof value.id === 'string'
    && 'sessionId' in value && typeof value.sessionId === 'string' && 'token' in value && typeof value.token === 'string'
}

function uploadValues(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [value]
}

export function uploadFormPatch<TValues extends object>(
  form: FormStore<TValues>,
  submitted: TValues,
  record: object,
  fields: readonly { readonly path: string, readonly type: string }[],
): Pick<FormServerPatch, 'operations' | 'committedOperations'> {
  const operations: FormOperation[] = []
  const committedOperations: FormOperation[] = []
  for (const field of fields) {
    if (field.type !== 'panels:field:upload') continue
    const saved = getPathValue(record, field.path)
    if (saved === undefined) continue
    committedOperations.push({ kind: 'set', path: field.path, value: saved })
    const submittedValue = getPathValue(submitted, field.path)
    const current = getPathValue(form.state.values, field.path)
    const originals = uploadValues(submittedValue)
    const paths = uploadValues(saved)
    const reconcile = (value: unknown): unknown => {
      const index = originals.findIndex(original => isTemporaryUpload(original) && isTemporaryUpload(value)
        ? original.token === value.token && original.sessionId === value.sessionId && original.id === value.id
        : original === value)
      return index >= 0 ? paths[index] ?? value : value
    }
    const value = current === submittedValue ? saved : Array.isArray(current) ? current.map(reconcile) : reconcile(current)
    operations.push({ kind: 'set', path: field.path, value })
  }
  return { operations, committedOperations }
}

export function bindUploadStore<TValues extends object>(
  form: FormStore<TValues>,
  path: FormPath<TValues>,
  upload: UploadStore,
  multiple: boolean,
): () => void {
  const hydrate = (): void => {
    const value = form.get(path)
    const paths: unknown[] = Array.isArray(value) ? value : [value]
    upload.reset(paths.flatMap(value => typeof value === 'string' && value
      ? [{ id: value, mimeType: '', name: value.split('/').at(-1) ?? value, size: 0 }]
      : []))
  }
  if (upload.state.items.length === 0) hydrate()
  let synchronizing = false
  const unsubscribeUpload = upload.subscribe(snapshot => {
    if (synchronizing) return
    const values = snapshot.items.flatMap<UploadFormValue>(item => {
      if (item.status === 'existing') return [item.id]
      return item.status === 'stored' && item.sessionId && item.token
        ? [{ id: item.id, sessionId: item.sessionId, token: item.token }]
        : []
    })
    const errors = [snapshot.error, ...snapshot.items.map(item => item.error)].filter((error): error is string => !!error)
    synchronizing = true
    try {
      form.batch([
        { kind: 'set', path, touch: true, value: multiple ? values : values[0] ?? '' },
        { kind: 'pending', path, value: snapshot.pending > 0 || errors.length > 0 },
        { kind: 'errors', path, errors },
      ])
    } finally {
      synchronizing = false
    }
  })
  const unsubscribeForm = form.subscribe((state, previous) => {
    if (synchronizing) return
    const reset = previous.touchedPaths.includes(path) && !state.touchedPaths.includes(path)
    const value = getPathValue(state.values, path)
    const previousValue = getPathValue(previous.values, path)
    if (!reset && value === previousValue) return
    synchronizing = true
    try {
      const originals = uploadValues(previousValue)
      const committed = new Map<string, string>()
      uploadValues(value).forEach((item, index) => {
        const original = originals[index]
        if (typeof item === 'string' && item && isTemporaryUpload(original)) committed.set(original.id, item)
      })
      if (reset || committed.size === 0 && !state.dirtyPaths.some(dirty => pathsOverlap(dirty, path)) && upload.state.pending === 0) {
        hydrate()
        form.batch([{ kind: 'pending', path, value: false }])
      } else {
        upload.commit(committed)
      }
    } finally {
      synchronizing = false
    }
  })
  return () => {
    unsubscribeUpload()
    unsubscribeForm()
  }
}
