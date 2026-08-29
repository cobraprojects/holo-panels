import type {
  CollectionStore,
  EditorAdapterRegistry,
  FormPath,
  FormStore,
  FormState,
  FormStateListener,
  FormValueAtPath,
  OptionStore,
  UploadStore,
} from '@holo-js/panels-client'
import type { VNodeChild } from 'vue'
import type { ComponentRegistry } from '../registry'

export type VueFieldPath<TValues extends object> = [FormPath<TValues>] extends [never] ? string : FormPath<TValues>

export type VueFieldValue<TValues extends object, TPath extends VueFieldPath<TValues>> = TPath extends FormPath<TValues>
  ? FormValueAtPath<TValues, TPath>
  : unknown

export interface VueCompiledField<
  TValues extends object,
  TPath extends VueFieldPath<TValues> = VueFieldPath<TValues>,
> {
  readonly debounceMilliseconds?: number
  readonly disabled: boolean
  readonly helperText: string | null
  readonly hint: string | null
  readonly label: string | null
  readonly path: TPath
  readonly placeholder: string | null
  readonly properties: Readonly<Record<string, unknown>>
  readonly readOnly: boolean
  readonly required: boolean
  readonly type: string
  readonly visible: boolean
}

export interface VueFieldRenderContext<
  TValues extends object,
  TPath extends VueFieldPath<TValues> = VueFieldPath<TValues>,
> {
  readonly definition: VueCompiledField<TValues, TPath>
  readonly disabled: boolean
  readonly errors: readonly string[]
  readonly actionPending?: (actionId: string) => boolean
  readonly executeAction?: (actionId: string) => void
  readonly inputId: string
  readonly readOnly: boolean
  readonly value: VueFieldValue<TValues, TPath>
}

export interface VueFormStore<TValues extends object> {
  readonly state: FormState<TValues>
  subscribe(listener: FormStateListener<TValues>): () => void
  batch(operations: Parameters<FormStore<TValues>['batch']>[0]): FormState<TValues>
}

export interface VueFieldRendererProps<
  TValues extends object,
  TPath extends VueFieldPath<TValues> = VueFieldPath<TValues>,
> {
  readonly collectionStore?: CollectionStore<unknown>
  readonly createCollectionItem?: (blockType?: string) => unknown
  readonly definition: VueCompiledField<TValues, TPath>
  readonly editorAdapters?: EditorAdapterRegistry
  readonly actionPending?: (actionId: string) => boolean
  readonly executeAction?: (actionId: string) => void
  readonly optionStore?: OptionStore<string | number>
  readonly panelId?: string
  readonly registry: ComponentRegistry
  readonly renderBuilderBlock?: (block: unknown, index: number) => VNodeChild
  readonly renderRepeaterItem?: (value: unknown, index: number) => VNodeChild
  readonly store: VueFormStore<TValues>
  readonly uploadStore?: UploadStore
}

export interface VueFieldControlProps<
  TValues extends object,
  TPath extends VueFieldPath<TValues> = VueFieldPath<TValues>,
> extends VueFieldRendererProps<TValues, TPath> {
  readonly context: VueFieldRenderContext<TValues, TPath>
}
