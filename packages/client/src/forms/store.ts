import { FormClientState } from '@holo-js/forms/internal/client'
import type { ValidationErrorBag } from '@holo-js/forms/schema'
import { validateFormFields, type FormValidationField } from '@holo-js/panels-core'
import { formValidationErrors } from './validation'
import { SchemaFocusIndex } from '../schema/focus'
import {
  cloneFormValue,
  collectDirtyPaths,
  getPathValue,
  parseFormPath,
  pathsOverlap,
  setPathValue,
  updateArrayPath,
} from './paths'
import type {
  FormDependency,
  FormFocusMetadata,
  FormOperation,
  FormPath,
  FormRequestContext,
  FormRequestResult,
  FormReactivityListener,
  FormServerPatch,
  FormState,
  FormStateListener,
  FormStoreOptions,
  FormSubmitResponse,
  FormValidationResponse,
  FormValueAtPath,
} from './types'

type RequestKind = 'submit' | 'validate'

interface ActiveRequest {
  readonly controller: AbortController
  readonly version: number
}

interface WorkingState<TValues> {
  values: TValues
  initialValues: TValues
  touchedPaths: Set<string>
  editedPaths: Set<string>
  errors: Record<string, readonly string[]>
  visibility: Record<string, boolean>
  disabled: Record<string, boolean>
  readOnly: Record<string, boolean>
  pending: Record<string, boolean>
  focus?: FormFocusMetadata
  changedPaths: Set<string>
  changed: boolean
}

function freezeValue<TValue>(value: TValue): TValue {
  const visited = new WeakSet<object>()
  const freeze = (current: object): void => {
    if (visited.has(current)) return
    visited.add(current)
    const prototype: unknown = Object.getPrototypeOf(current)
    const canFreeze = Array.isArray(current) || prototype === Object.prototype || prototype === null
    if (!canFreeze) return
    for (const child of Reflect.ownKeys(current).map(key => Reflect.get(current, key))) {
      if (typeof child === 'object' && child !== null) freeze(child)
    }
    Object.freeze(current)
  }
  if (typeof value === 'object' && value !== null) freeze(value)
  return value
}

function frozenRecord<TValue>(value: Readonly<Record<string, TValue>>): Readonly<Record<string, TValue>> {
  return Object.freeze({ ...value })
}

function normalizeErrors(
  errors: Readonly<Record<string, string | readonly string[]>>,
): Record<string, readonly string[]> {
  return Object.fromEntries(Object.entries(errors).flatMap(([path, messages]) => {
    parseFormPath(path)
    const normalized = (typeof messages === 'string' ? [messages] : messages)
      .map(message => message.trim())
      .filter(Boolean)
    return normalized.length > 0 ? [[path, Object.freeze(normalized)]] : []
  }))
}

function setFlag(record: Record<string, boolean>, path: string, value: boolean): Record<string, boolean> {
  if (record[path] === value) return record
  return { ...record, [path]: value }
}

function removePathAndDescendants<TValue>(record: Record<string, TValue>, path: string): Record<string, TValue> {
  const entries = Object.entries(record).filter(([candidate]) => !pathsOverlap(candidate, path))
  return entries.length === Object.keys(record).length ? record : Object.fromEntries(entries)
}

function sameStringSet(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  return left.size === right.size && [...left].every(value => right.has(value))
}

function remapArrayPath(
  candidate: string,
  arrayPath: string,
  operation: Extract<FormOperation, { kind: 'array-insert' | 'array-move' | 'array-remove' }>,
): string | undefined {
  if (!candidate.startsWith(`${arrayPath}.`)) return candidate
  const suffix = candidate.slice(arrayPath.length + 1)
  const [indexSegment, ...remaining] = suffix.split('.')
  const index = Number(indexSegment)
  if (!Number.isSafeInteger(index) || index < 0) return candidate
  let nextIndex = index
  if (operation.kind === 'array-insert') {
    if (index >= operation.index) nextIndex = index + 1
  } else if (operation.kind === 'array-remove') {
    if (index === operation.index) return undefined
    if (index > operation.index) nextIndex = index - 1
  } else if (index === operation.from) {
    nextIndex = operation.to
  } else if (operation.from < operation.to && index > operation.from && index <= operation.to) {
    nextIndex = index - 1
  } else if (operation.from > operation.to && index >= operation.to && index < operation.from) {
    nextIndex = index + 1
  }
  return [arrayPath, String(nextIndex), ...remaining].join('.')
}

function remapArrayRecord<TValue>(
  record: Record<string, TValue>,
  path: string,
  operation: Extract<FormOperation, { kind: 'array-insert' | 'array-move' | 'array-remove' }>,
): Record<string, TValue> {
  return Object.fromEntries(Object.entries(record).flatMap(([candidate, value]) => {
    const remapped = remapArrayPath(candidate, path, operation)
    return remapped ? [[remapped, value]] : []
  }))
}

export class FormStore<TValues extends object> {
  #editedPaths = new Set<string>()
  readonly #form: FormClientState<TValues>
  readonly #fields: readonly FormValidationField[]
  #correctionSequence = 0
  readonly #deferredDependencyPaths = new Set<string>()
  readonly #dependencyTimers = new Map<string, ReturnType<typeof setTimeout>>()
  #state: FormState<TValues>
  readonly #listeners = new Set<FormStateListener<TValues>>()
  readonly #reactivityListeners = new Set<FormReactivityListener<TValues>>()
  readonly #dependencies = new Map<string, FormDependency<TValues>>()
  readonly #focusIndex: SchemaFocusIndex<TValues>
  readonly #requests = new Map<RequestKind, ActiveRequest>()
  #requestSequence = 0
  #serverPatchVersion = 0

  constructor(initialValues: TValues, options: FormStoreOptions<TValues> = {}) {
    const values = freezeValue(cloneFormValue(initialValues))
    this.#form = new FormClientState(values)
    this.#form.replace(values, values, {}, new Set())
    this.#fields = options.fields ?? []
    this.#focusIndex = new SchemaFocusIndex(options.schema)
    for (const dependency of options.dependencies ?? []) this.addDependency(dependency)
    this.#state = Object.freeze({
      values,
      initialValues: values,
      dirtyPaths: Object.freeze([]),
      touchedPaths: Object.freeze([]),
      errors: Object.freeze({}),
      visibility: Object.freeze({}),
      disabled: Object.freeze({}),
      readOnly: Object.freeze({}),
      pending: Object.freeze({}),
      validating: false,
      submitting: false,
      version: 0,
    })
  }

  get state(): FormState<TValues> {
    return this.#state
  }

  get errorBag(): ValidationErrorBag<TValues> {
    return this.#form.errors
  }

  get<TPath extends FormPath<TValues>>(path: TPath): FormValueAtPath<TValues, TPath> {
    return getPathValue(this.#state.values, path) as FormValueAtPath<TValues, TPath>
  }

  subscribe(listener: FormStateListener<TValues>): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  registerDependency(dependency: FormDependency<TValues>): () => void {
    this.addDependency(dependency)
    return () => this.#dependencies.delete(dependency.id)
  }

  set<TPath extends FormPath<TValues>>(
    path: TPath,
    value: FormValueAtPath<TValues, TPath>,
    options: { readonly touch?: boolean } = {},
  ): FormState<TValues> {
    return this.batch([{ kind: 'set', path, value, touch: options.touch }])
  }

  touch<TPath extends FormPath<TValues>>(path: TPath, touched = true): FormState<TValues> {
    return this.batch([{ kind: 'touch', path, touched }])
  }

  insert<TPath extends FormPath<TValues>>(path: TPath, index: number, value: unknown): FormState<TValues> {
    return this.batch([{ kind: 'array-insert', path, index, value }])
  }

  remove<TPath extends FormPath<TValues>>(path: TPath, index: number): FormState<TValues> {
    return this.batch([{ kind: 'array-remove', path, index }])
  }

  move<TPath extends FormPath<TValues>>(path: TPath, from: number, to: number): FormState<TValues> {
    return this.batch([{ kind: 'array-move', path, from, to }])
  }

  batch(
    operations: readonly FormOperation[],
    options: { readonly notifyReactivity?: boolean } = {},
  ): FormState<TValues> {
    if (operations.length === 0) return this.#state
    const working = this.createWorkingState()
    this.applyOperations(working, operations)
    const flushPaths = operations.flatMap(operation => operation.kind === 'reactivity-flush' || operation.kind === 'touch' && this.#deferredDependencyPaths.has(operation.path) ? [operation.path] : [])
    const deferredSets = operations.filter((operation): operation is Extract<FormOperation, { kind: 'set' }> => operation.kind === 'set' && operation.reactivity !== undefined)
    const immediateSets = operations.filter((operation): operation is Extract<FormOperation, { kind: 'set' }> => operation.kind === 'set' && operation.reactivity === undefined)
    for (const operation of immediateSets) this.clearDeferredDependency(operation.path)
    for (const operation of deferredSets) this.#deferredDependencyPaths.add(operation.path)
    const deferred = new Set(deferredSets.map(operation => operation.path))
    working.changedPaths = new Set([...working.changedPaths].filter(path => !deferred.has(path)))
    for (const path of flushPaths) {
      this.clearDeferredDependency(path)
      working.changedPaths.add(path)
    }
    this.recomputeDependencies(working)
    const result = this.commit(working)
    for (const operation of deferredSets) {
      const reactivity = operation.reactivity
      if (reactivity && reactivity !== 'blur') this.scheduleDependencyFlush(operation.path, reactivity.debounceMilliseconds)
    }
    if (working.changedPaths.size > 0) this.revalidateInvalidFields()
    if (options.notifyReactivity !== false && working.changedPaths.size > 0) this.publishReactivity(result, working.changedPaths)
    return result
  }

  subscribeReactivity(listener: FormReactivityListener<TValues>): () => void {
    this.#reactivityListeners.add(listener)
    return () => this.#reactivityListeners.delete(listener)
  }

  private clearDeferredDependency(path: string): void {
    this.#deferredDependencyPaths.delete(path)
    const timer = this.#dependencyTimers.get(path)
    if (timer) clearTimeout(timer)
    this.#dependencyTimers.delete(path)
  }

  private clearDeferredDependencies(path?: string): void {
    for (const deferredPath of [...this.#deferredDependencyPaths]) {
      if (!path || pathsOverlap(deferredPath, path)) this.clearDeferredDependency(deferredPath)
    }
  }

  private scheduleDependencyFlush(path: string, milliseconds: number): void {
    if (!Number.isSafeInteger(milliseconds) || milliseconds < 0 || milliseconds > 60_000) throw new Error('Field debounce must be from 0 to 60000 milliseconds')
    const active = this.#dependencyTimers.get(path)
    if (active) clearTimeout(active)
    this.#dependencyTimers.set(path, setTimeout(() => this.batch([{ kind: 'reactivity-flush', path }]), milliseconds))
  }

  reset(): FormState<TValues> {
    this.#correctionSequence++
    this.clearDeferredDependencies()
    const working = this.createWorkingState()
    const changedPaths = collectDirtyPaths(working.values, working.initialValues)
    working.values = working.initialValues
    working.changedPaths = new Set(changedPaths)
    working.touchedPaths.clear()
    working.changed ||= working.editedPaths.size > 0
    working.editedPaths.clear()
    working.errors = {}
    working.focus = undefined
    working.changed = working.changed || changedPaths.length > 0
      || this.#state.touchedPaths.length > 0
      || Object.keys(this.#state.errors).length > 0
      || typeof this.#state.focus !== 'undefined'
    this.recomputeDependencies(working)
    const result = this.commit(working)
    if (working.changedPaths.size > 0) this.publishReactivity(result, working.changedPaths)
    return result
  }

  resetField<TPath extends FormPath<TValues>>(path: TPath): FormState<TValues> {
    parseFormPath(path)
    this.clearDeferredDependencies(path)
    const initialValue = getPathValue(this.#state.initialValues, path)
    const working = this.createWorkingState()
    const nextValues = setPathValue(working.values, path, initialValue)
    if (nextValues !== working.values) {
      working.values = nextValues
      working.changedPaths.add(path)
      working.changed = true
    }
    const touched = new Set([...working.touchedPaths].filter(candidate => !pathsOverlap(candidate, path)))
    const edited = new Set([...working.editedPaths].filter(candidate => !pathsOverlap(candidate, path)))
    working.changed ||= !sameStringSet(edited, working.editedPaths)
    working.editedPaths = edited
    if (!sameStringSet(touched, working.touchedPaths)) {
      working.touchedPaths = touched
      working.changed = true
    }
    const errors = removePathAndDescendants(working.errors, path)
    if (errors !== working.errors) {
      working.errors = errors
      working.changed = true
    }
    if (working.focus && pathsOverlap(working.focus.path, path)) {
      working.focus = undefined
      working.changed = true
    }
    this.recomputeDependencies(working)
    const result = this.commit(working)
    if (working.changedPaths.size > 0) this.publishReactivity(result, working.changedPaths)
    return result
  }

  focusFirstError(requestVersion?: number): FormFocusMetadata | undefined {
    const focus = this.#focusIndex.firstError(this.#state.errors, requestVersion)
    if (focus === this.#state.focus) return focus
    this.publish({ ...this.#state, focus, version: this.#state.version + 1 })
    return focus
  }

  applyServerPatch(patch: FormServerPatch, version?: number): boolean {
    if (typeof version === 'number') {
      if (!Number.isSafeInteger(version) || version <= 0) throw new Error(`Invalid server patch version: ${version}`)
      if (version <= this.#serverPatchVersion) return false
    }
    this.#correctionSequence++
    this.applyResponse(patch, version)
    if (typeof version === 'number') this.#serverPatchVersion = version
    return true
  }

  async validateRequest(
    validate: (context: FormRequestContext<TValues>) => Promise<FormValidationResponse>,
  ): Promise<FormRequestResult> {
    return this.runRequest('validate', validate)
  }

  async submit(
    submit: (context: FormRequestContext<TValues>) => Promise<FormSubmitResponse>,
    options: { readonly validate?: boolean } = {},
  ): Promise<FormRequestResult> {
    this.cancelRequests('validate')
    this.#correctionSequence++
    let blocked = false
    const result = await this.runRequest('submit', async context => {
      if (options.validate !== false) {
        const pendingErrors = Object.fromEntries(Object.entries(this.#state.pending)
          .filter(([, pending]) => pending)
          .map(([path]) => [path, this.#state.errors[path]?.length ? this.#state.errors[path] : ['Wait for this field to finish before saving.']]))
        if (Object.keys(pendingErrors).length) {
          blocked = true
          return { errors: { ...this.#state.errors, ...pendingErrors }, focusFirstError: true }
        }
      }
      const errors = options.validate === false ? {} : await validateFormFields(this.validationFields(), context.values)
      if (Object.keys(errors).length) return { errors, focusFirstError: true }
      if (context.signal.aborted) return {}
      try {
        return { errors: {}, ...await submit(context) }
      } catch (cause) {
        const errors = formValidationErrors(cause)
        if (errors) return { errors, focusFirstError: true }
        throw cause
      }
    })
    return result.status === 'applied' && (blocked || Object.keys(this.#state.errors).length > 0)
      ? { ...result, status: 'invalid' }
      : result
  }

  private validationFields(): readonly FormValidationField[] {
    return this.#fields.map(field => ({
      ...field,
      visible: this.#state.visibility[field.path] ?? field.visible,
      disabled: this.#state.disabled[field.path] ?? field.disabled,
      readOnly: this.#state.readOnly[field.path] ?? field.readOnly,
    }))
  }

  private revalidateInvalidFields(): void {
    const fields = this.validationFields().filter(field => !this.#state.pending[field.path] && Object.hasOwn(this.#state.errors, field.path))
    if (!fields.length) return
    const sequence = ++this.#correctionSequence
    const values = this.#state.values
    void validateFormFields(fields, values).then(errors => {
      if (sequence !== this.#correctionSequence || values !== this.#state.values || this.#state.submitting) return
      this.batch(fields.map(field => ({ kind: 'errors', path: field.path, errors: errors[field.path] ?? [] })))
    })
  }

  cancelRequests(kind?: RequestKind): void {
    if (!kind) this.clearDeferredDependencies()
    const requests = kind ? [[kind, this.#requests.get(kind)] as const] : [...this.#requests.entries()]
    let validating = this.#state.validating
    let submitting = this.#state.submitting
    for (const [requestKind, request] of requests) {
      request?.controller.abort()
      if (requestKind === 'validate') validating = false
      else submitting = false
    }
    if (validating !== this.#state.validating || submitting !== this.#state.submitting) {
      this.publish({
        ...this.#state,
        validating,
        submitting,
        version: this.#state.version + 1,
      })
    }
  }

  private addDependency(dependency: FormDependency<TValues>): void {
    if (!dependency.id.trim()) throw new Error('Form dependency ID cannot be empty')
    if (this.#dependencies.has(dependency.id)) throw new Error(`Duplicate form dependency: ${dependency.id}`)
    dependency.paths.forEach(parseFormPath)
    this.#dependencies.set(dependency.id, dependency)
  }

  private createWorkingState(): WorkingState<TValues> {
    return {
      values: this.#form.values,
      initialValues: this.#form.initialValues,
      touchedPaths: new Set(this.#form.touched),
      editedPaths: new Set(this.#editedPaths),
      errors: { ...this.#form.errors.flatten() },
      visibility: { ...this.#state.visibility },
      disabled: { ...this.#state.disabled },
      readOnly: { ...this.#state.readOnly },
      pending: { ...this.#state.pending },
      ...(this.#state.focus ? { focus: this.#state.focus } : {}),
      changedPaths: new Set(),
      changed: false,
    }
  }

  private applyOperations(working: WorkingState<TValues>, operations: readonly FormOperation[]): void {
    for (const operation of operations) {
      parseFormPath(operation.path)
      if (operation.kind === 'set') {
        const next = setPathValue(working.values, operation.path, cloneFormValue(operation.value))
        if (next !== working.values) {
          working.values = next
          working.changedPaths.add(operation.path)
          working.changed = true
        }
        if (operation.touch) {
          this.applyTouch(working, operation.path, true)
          working.changed ||= !working.editedPaths.has(operation.path)
          working.editedPaths.add(operation.path)
        }
      } else if (operation.kind === 'reactivity-flush') {
        working.changedPaths.add(operation.path)
      } else if (operation.kind === 'touch') {
        this.applyTouch(working, operation.path, operation.touched ?? true)
      } else if (operation.kind === 'errors') {
        const messages = Object.freeze(operation.errors.map(message => message.trim()).filter(Boolean))
        const previous = working.errors[operation.path]
        if (messages.length === 0) {
          if (previous) {
            delete working.errors[operation.path]
            if (working.focus?.path === operation.path) working.focus = undefined
            working.changed = true
          }
        } else if (!previous || previous.length !== messages.length || previous.some((message, index) => message !== messages[index])) {
          working.errors[operation.path] = messages
          working.changed = true
        }
      } else if (operation.kind === 'visible') {
        const next = setFlag(working.visibility, operation.path, operation.value)
        working.changed ||= next !== working.visibility
        working.visibility = next
      } else if (operation.kind === 'disabled') {
        const next = setFlag(working.disabled, operation.path, operation.value)
        working.changed ||= next !== working.disabled
        working.disabled = next
      } else if (operation.kind === 'read-only') {
        const next = setFlag(working.readOnly, operation.path, operation.value)
        working.changed ||= next !== working.readOnly
        working.readOnly = next
      } else if (operation.kind === 'pending') {
        const next = setFlag(working.pending, operation.path, operation.value)
        working.changed ||= next !== working.pending
        working.pending = next
      } else {
        this.applyArrayOperation(working, operation)
      }
    }
  }

  private applyArrayOperation(
    working: WorkingState<TValues>,
    operation: Extract<FormOperation, { kind: 'array-insert' | 'array-move' | 'array-remove' }>,
  ): void {
    const next = updateArrayPath(working.values, operation.path, (items) => {
      if (operation.kind === 'array-insert') {
        if (!Number.isSafeInteger(operation.index) || operation.index < 0 || operation.index > items.length) throw new Error(`Invalid array insertion index: ${operation.index}`)
        return [...items.slice(0, operation.index), cloneFormValue(operation.value), ...items.slice(operation.index)]
      }
      if (operation.kind === 'array-remove') {
        if (!Number.isSafeInteger(operation.index) || operation.index < 0 || operation.index >= items.length) throw new Error(`Invalid array removal index: ${operation.index}`)
        return [...items.slice(0, operation.index), ...items.slice(operation.index + 1)]
      }
      if (!Number.isSafeInteger(operation.from) || !Number.isSafeInteger(operation.to) || operation.from < 0 || operation.from >= items.length || operation.to < 0 || operation.to >= items.length) {
        throw new Error(`Invalid array move: ${operation.from} to ${operation.to}`)
      }
      if (operation.from === operation.to) return items
      const result = [...items]
      const [item] = result.splice(operation.from, 1)
      result.splice(operation.to, 0, item)
      return result
    })
    if (next === working.values) return
    working.values = next
    working.changedPaths.add(operation.path)
    working.touchedPaths = new Set([...working.touchedPaths].flatMap((candidate) => {
      const remapped = remapArrayPath(candidate, operation.path, operation)
      return remapped ? [remapped] : []
    }))
    working.errors = remapArrayRecord(working.errors, operation.path, operation)
    working.editedPaths = new Set([...working.editedPaths].flatMap(candidate => {
      const remapped = remapArrayPath(candidate, operation.path, operation)
      return remapped ? [remapped] : []
    }))
    working.visibility = remapArrayRecord(working.visibility, operation.path, operation)
    working.disabled = remapArrayRecord(working.disabled, operation.path, operation)
    working.readOnly = remapArrayRecord(working.readOnly, operation.path, operation)
    working.pending = remapArrayRecord(working.pending, operation.path, operation)
    if (working.focus) {
      const remapped = remapArrayPath(working.focus.path, operation.path, operation)
      working.focus = remapped ? { ...working.focus, path: remapped } : undefined
    }
    working.changed = true
  }

  private applyTouch(working: WorkingState<TValues>, path: string, touched: boolean): void {
    const hadPath = working.touchedPaths.has(path)
    if (touched === hadPath) return
    if (touched) working.touchedPaths.add(path)
    else working.touchedPaths.delete(path)
    working.changed = true
  }

  private recomputeDependencies(working: WorkingState<TValues>): void {
    const recomputed = new Set<string>()
    let found = true
    while (found) {
      found = false
      for (const dependency of this.#dependencies.values()) {
        if (recomputed.has(dependency.id)) continue
        if (!dependency.paths.some(path => [...working.changedPaths].some(changed => pathsOverlap(path, changed)))) continue
        recomputed.add(dependency.id)
        found = true
        const operations = dependency.recompute({
          changedPaths: working.changedPaths,
          editedPaths: working.editedPaths,
          get: path => getPathValue(working.values, path) as FormValueAtPath<TValues, typeof path>,
          touchedPaths: working.touchedPaths,
        })
        this.applyOperations(working, operations)
      }
    }
  }

  private commit(working: WorkingState<TValues>): FormState<TValues> {
    if (!working.changed) return this.#state
    this.#editedPaths = working.editedPaths
    const values = freezeValue(working.values)
    this.#form.replace(values, working.initialValues, working.errors, working.touchedPaths)
    const dirtyPaths = Object.freeze([...this.#form.dirtyPaths].sort())
    const touchedPaths = Object.freeze([...working.touchedPaths].sort())
    return this.publish({
      ...this.#state,
      values,
      initialValues: working.initialValues,
      dirtyPaths,
      touchedPaths,
      errors: frozenRecord(this.#form.errors.flatten()),
      visibility: frozenRecord(working.visibility),
      disabled: frozenRecord(working.disabled),
      readOnly: frozenRecord(working.readOnly),
      pending: frozenRecord(working.pending),
      ...(working.focus ? { focus: working.focus } : { focus: undefined }),
      version: this.#state.version + 1,
    })
  }

  private publish(next: FormState<TValues>): FormState<TValues> {
    const previous = this.#state
    this.#state = Object.freeze(next)
    for (const listener of this.#listeners) listener(this.#state, previous)
    return this.#state
  }

  private publishReactivity(state: FormState<TValues>, changedPaths: ReadonlySet<string>): void {
    const paths = new Set(changedPaths)
    for (const listener of this.#reactivityListeners) listener(state, paths)
  }

  private applyResponse(patch: FormServerPatch, requestVersion?: number, requestKind?: RequestKind, submittedValues?: TValues): void {
    const working = this.createWorkingState()
    this.applyOperations(working, patch.operations ?? [])
    if (patch.errors) {
      const errors = normalizeErrors(patch.errors)
      working.changed ||= JSON.stringify(errors) !== JSON.stringify(working.errors)
      working.errors = errors
      if (working.focus && !errors[working.focus.path]) {
        working.focus = undefined
        working.changed = true
      }
    }
    this.recomputeDependencies(working)
    if (patch.commitValues) {
      if (submittedValues && this.#state.values !== submittedValues || patch.committedOperations) {
        const committed = this.createWorkingState()
        committed.values = submittedValues ?? working.values
        this.applyOperations(committed, patch.committedOperations ?? patch.operations ?? [])
        this.recomputeDependencies(committed)
        working.initialValues = freezeValue(committed.values)
      } else {
        working.initialValues = working.values
      }
      working.changed = true
    }
    if (patch.focusFirstError) {
      working.focus = this.#focusIndex.firstError(working.errors, requestVersion)
      working.changed = true
    }
    const previous = this.#state
    const validating = requestKind === 'validate' ? false : previous.validating
    const submitting = requestKind === 'submit' ? false : previous.submitting
    if (!working.changed && validating === previous.validating && submitting === previous.submitting) return
    this.#editedPaths = working.editedPaths
    const values = freezeValue(working.values)
    this.#form.replace(values, working.initialValues, working.errors, working.touchedPaths)
    this.publish({
      ...previous,
      values,
      initialValues: working.initialValues,
      dirtyPaths: Object.freeze([...this.#form.dirtyPaths].sort()),
      touchedPaths: Object.freeze([...working.touchedPaths].sort()),
      errors: frozenRecord(this.#form.errors.flatten()),
      visibility: frozenRecord(working.visibility),
      disabled: frozenRecord(working.disabled),
      readOnly: frozenRecord(working.readOnly),
      pending: frozenRecord(working.pending),
      validating,
      submitting,
      ...(working.focus ? { focus: working.focus } : { focus: undefined }),
      version: previous.version + 1,
    })
  }

  private async runRequest<TResponse extends FormServerPatch>(
    kind: RequestKind,
    request: (context: FormRequestContext<TValues>) => Promise<TResponse>,
  ): Promise<FormRequestResult> {
    this.#requests.get(kind)?.controller.abort()
    const active: ActiveRequest = {
      controller: new AbortController(),
      version: ++this.#requestSequence,
    }
    this.#requests.set(kind, active)
    const finishSubmission = kind === 'submit' ? this.#form.startSubmission(active.controller.signal) : () => undefined
    this.publish({
      ...this.#state,
      ...(kind === 'validate' ? { validating: true } : { submitting: this.#form.submitting }),
      version: this.#state.version + 1,
    })
    const requestValues = this.#state.values
    const context: FormRequestContext<TValues> = {
      values: requestValues,
      version: active.version,
      signal: active.controller.signal,
      get: path => getPathValue(requestValues, path) as FormValueAtPath<TValues, typeof path>,
    }
    try {
      const response = await request(context)
      if (this.#requests.get(kind) !== active) return { status: 'stale', version: active.version }
      if (active.version < this.#requestSequence) {
        this.#requests.delete(kind)
        this.clearRequestFlag(kind)
        return { status: 'stale', version: active.version }
      }
      this.#requests.delete(kind)
      if (active.controller.signal.aborted) {
        this.clearRequestFlag(kind)
        return { status: 'aborted', version: active.version }
      }
      this.applyResponse(response, active.version, kind, kind === 'submit' ? requestValues : undefined)
      return { status: 'applied', version: active.version }
    } catch (error) {
      if (this.#requests.get(kind) !== active) return { status: 'stale', version: active.version }
      this.#requests.delete(kind)
      this.clearRequestFlag(kind)
      if (active.controller.signal.aborted || error instanceof DOMException && error.name === 'AbortError') {
        return { status: 'aborted', version: active.version }
      }
      throw error
    } finally {
      finishSubmission()
    }
  }

  private clearRequestFlag(kind: RequestKind): void {
    if ((kind === 'validate' && !this.#state.validating) || (kind === 'submit' && !this.#state.submitting)) return
    const next = kind === 'validate'
      ? { ...this.#state, validating: false, version: this.#state.version + 1 }
      : { ...this.#state, submitting: false, version: this.#state.version + 1 }
    this.publish(next)
  }
}
