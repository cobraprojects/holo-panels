import { useSyncExternalStore } from 'react'
import type { FormState, FormStore, SchemaStateStore, TableRecordId, TableState, TableStateStore } from '@holo-js/panels-client'

type SchemaSnapshot<TValues> = SchemaStateStore<TValues>['schema']

export interface PanelsExternalStore<TSnapshot> {
  subscribe(listener: () => void): () => void
  getSnapshot(): TSnapshot
  getServerSnapshot?(): TSnapshot
}

function identity<TValue>(value: TValue): TValue {
  return value
}

export function usePanelsStore<TSnapshot, TSelection = TSnapshot>(
  store: PanelsExternalStore<TSnapshot>,
  selector: (snapshot: TSnapshot) => TSelection = identity as (snapshot: TSnapshot) => TSelection,
): TSelection {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot ?? store.getSnapshot)
  return selector(snapshot)
}

export function useFormStore<TValues extends object, TSelection = FormState<TValues>>(
  store: FormStore<TValues>,
  selector: (state: FormState<TValues>) => TSelection = identity as (state: FormState<TValues>) => TSelection,
): TSelection {
  return usePanelsStore({
    subscribe: listener => store.subscribe(listener),
    getSnapshot: () => store.state,
  }, selector)
}

export function useSchemaStore<TValues, TSelection = SchemaSnapshot<TValues>>(
  store: SchemaStateStore<TValues>,
  selector: (schema: SchemaSnapshot<TValues>) => TSelection = identity as (
    schema: SchemaSnapshot<TValues>
  ) => TSelection,
): TSelection {
  return usePanelsStore({
    subscribe: listener => store.subscribe(listener),
    getSnapshot: () => store.schema,
  }, selector)
}

export function useTableStore<
  TRecord extends object,
  TRecordId extends TableRecordId,
  TSelection = TableState<TRecord, TRecordId>,
>(
  store: TableStateStore<TRecord, TRecordId>,
  selector: (state: TableState<TRecord, TRecordId>) => TSelection = identity as (
    state: TableState<TRecord, TRecordId>
  ) => TSelection,
): TSelection {
  return usePanelsStore({
    subscribe: listener => store.subscribe(listener),
    getSnapshot: () => store.snapshot,
  }, selector)
}
