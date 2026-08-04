import type {
  CollectionStore,
  EditorAdapterRegistry,
  FormPath,
  FormStore,
  FormState,
  FormStateListener,
  OptionStore,
  UploadStore,
} from '@holo-js/panels-client'
import type { VNodeChild } from 'vue'
import type { ComponentRegistry } from '../registry'

export interface VueCompiledField<TValues extends object> {
  readonly disabled: boolean
  readonly helperText: string | null
  readonly hint: string | null
  readonly label: string | null
  readonly path: [FormPath<TValues>] extends [never] ? string : FormPath<TValues>
  readonly placeholder: string | null
  readonly properties: Readonly<Record<string, unknown>>
  readonly readOnly: boolean
  readonly required: boolean
  readonly type: string
  readonly visible: boolean
}

export interface VueFieldRenderContext<TValues extends object> {
  readonly definition: VueCompiledField<TValues>
  readonly disabled: boolean
  readonly errors: readonly string[]
  readonly inputId: string
  readonly readOnly: boolean
  readonly value: unknown
}

export interface VueFormStore<TValues extends object> {
  readonly state: FormState<TValues>
  subscribe(listener: FormStateListener<TValues>): () => void
  batch(operations: Parameters<FormStore<TValues>['batch']>[0]): FormState<TValues>
}

export interface VueFieldRendererProps<TValues extends object> {
  readonly collectionStore?: CollectionStore<unknown>
  readonly createCollectionItem?: () => unknown
  readonly definition: VueCompiledField<TValues>
  readonly editorAdapters?: EditorAdapterRegistry
  readonly optionStore?: OptionStore<string | number>
  readonly panelId?: string
  readonly registry: ComponentRegistry
  readonly renderBuilderBlock?: (block: unknown, index: number) => VNodeChild
  readonly renderRepeaterItem?: (value: unknown, index: number) => VNodeChild
  readonly store: VueFormStore<TValues>
  readonly uploadStore?: UploadStore
}

export interface VueFieldControlProps<TValues extends object> extends VueFieldRendererProps<TValues> {
  readonly context: VueFieldRenderContext<TValues>
}
