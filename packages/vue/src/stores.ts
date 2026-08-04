import type {
  FormState,
  FormStore,
  SchemaStateStore,
  TableRecordId,
  TableState,
  TableStateStore,
} from '@holo-js/panels-client'
import {
  getCurrentScope,
  onScopeDispose,
  readonly,
  shallowRef,
  type DeepReadonly,
  type ShallowRef,
} from 'vue'

export type VueStoreRef<TState> = DeepReadonly<ShallowRef<TState>>

export interface PanelsStore<TState> {
  readonly state?: TState
  readonly schema?: TState
  readonly snapshot?: TState
  subscribe(listener: (state: TState, previous: TState) => void): () => void
}

function bindStore<TState>(
  initialState: TState,
  subscribe: (listener: (state: TState) => void) => () => void,
): VueStoreRef<TState> {
  const state = shallowRef(initialState)
  const unsubscribe = subscribe(next => {
    state.value = next
  })
  if (getCurrentScope()) onScopeDispose(unsubscribe)
  return readonly(state)
}

export function useFormStore<TValues extends object>(
  store: FormStore<TValues>,
): VueStoreRef<FormState<TValues>>
export function useFormStore<TValues extends object, TSelected>(
  store: FormStore<TValues>,
  selector: (state: FormState<TValues>) => TSelected,
): VueStoreRef<TSelected>
export function useFormStore<TValues extends object, TSelected>(
  store: FormStore<TValues>,
  selector?: (state: FormState<TValues>) => TSelected,
): VueStoreRef<FormState<TValues>> | VueStoreRef<TSelected> {
  if (!selector) return bindStore(store.state, listener => store.subscribe(listener))
  return bindStore(selector(store.state), listener => store.subscribe(state => listener(selector(state))))
}

function currentStoreState<TState>(store: PanelsStore<TState>): TState {
  if (typeof store.state !== 'undefined') return store.state
  if (typeof store.schema !== 'undefined') return store.schema
  if (typeof store.snapshot !== 'undefined') return store.snapshot
  throw new Error('[Holo Panels] A Vue-bound store must expose state, schema, or snapshot.')
}

export function usePanelsStore<TState>(store: PanelsStore<TState>): VueStoreRef<TState>
export function usePanelsStore<TState, TSelected>(
  store: PanelsStore<TState>,
  selector: (state: TState) => TSelected,
): VueStoreRef<TSelected>
export function usePanelsStore<TState, TSelected>(
  store: PanelsStore<TState>,
  selector?: (state: TState) => TSelected,
): VueStoreRef<TState> | VueStoreRef<TSelected> {
  if (!selector) return bindStore(currentStoreState(store), listener => store.subscribe(listener))
  return bindStore(selector(currentStoreState(store)), listener => store.subscribe(state => listener(selector(state))))
}

export function useSchemaStore<TValues>(
  store: SchemaStateStore<TValues>,
): VueStoreRef<SchemaStateStore<TValues>['schema']>
export function useSchemaStore<TValues, TSelected>(
  store: SchemaStateStore<TValues>,
  selector: (schema: SchemaStateStore<TValues>['schema']) => TSelected,
): VueStoreRef<TSelected>
export function useSchemaStore<TValues, TSelected>(
  store: SchemaStateStore<TValues>,
  selector?: (schema: SchemaStateStore<TValues>['schema']) => TSelected,
): VueStoreRef<SchemaStateStore<TValues>['schema']> | VueStoreRef<TSelected> {
  if (!selector) return bindStore(store.schema, listener => store.subscribe(listener))
  return bindStore(selector(store.schema), listener => store.subscribe(schema => listener(selector(schema))))
}

export function useTableStore<TRecord extends object, TRecordId extends TableRecordId>(
  store: TableStateStore<TRecord, TRecordId>,
): VueStoreRef<TableState<TRecord, TRecordId>>
export function useTableStore<TRecord extends object, TRecordId extends TableRecordId, TSelected>(
  store: TableStateStore<TRecord, TRecordId>,
  selector: (state: TableState<TRecord, TRecordId>) => TSelected,
): VueStoreRef<TSelected>
export function useTableStore<TRecord extends object, TRecordId extends TableRecordId, TSelected>(
  store: TableStateStore<TRecord, TRecordId>,
  selector?: (state: TableState<TRecord, TRecordId>) => TSelected,
): VueStoreRef<TableState<TRecord, TRecordId>> | VueStoreRef<TSelected> {
  if (!selector) return bindStore(store.snapshot, listener => store.subscribe(listener))
  return bindStore(selector(store.snapshot), listener => store.subscribe(state => listener(selector(state))))
}
