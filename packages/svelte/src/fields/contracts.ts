import type {
  CollectionStore,
  FormPath,
  FormStore,
  FormValueAtPath,
  JsonObject,
  JsonValue,
  OptionStore,
  OptionValue,
  UploadStore,
} from '@holo-js/panels-client'
import type { Snippet } from 'svelte'
import type { SvelteComponentRegistry } from '../registry'

export interface FieldControlAttributes {
  readonly 'aria-describedby'?: string
  readonly 'aria-errormessage'?: string
  readonly 'aria-invalid'?: true
  readonly id: string
}

export interface SvelteFieldFrameProps {
  readonly children: Snippet<[FieldControlAttributes]>
  readonly description?: string
  readonly errors?: readonly string[]
  readonly executeAction?: (actionId: string) => void
  readonly hintAction?: JsonValue
  readonly hint?: string
  readonly inputId: string
  readonly label: string
  readonly path: string
  readonly required?: boolean
  readonly type: string
}

export type SvelteFieldPath<TValues extends object> = [FormPath<TValues>] extends [never] ? string : FormPath<TValues>

export type SvelteFieldValue<TValues extends object, TPath extends SvelteFieldPath<TValues>> = TPath extends FormPath<TValues>
  ? FormValueAtPath<TValues, TPath>
  : unknown

export interface SvelteFieldDefinition<
  TValues extends object = Record<string, unknown>,
  TPath extends SvelteFieldPath<TValues> = SvelteFieldPath<TValues>,
> {
  readonly debounceMilliseconds?: number
  readonly type: string
  readonly path: TPath
  readonly label: string
  readonly helperText?: string
  readonly hint?: string
  readonly placeholder?: string
  readonly visible?: boolean
  readonly disabled?: boolean
  readonly readOnly?: boolean
  readonly required?: boolean
  readonly properties?: JsonObject
}

export type SvelteFormStore<TValues extends object = Record<string, unknown>> = Pick<FormStore<TValues>, 'batch' | 'state' | 'subscribe'>
export type SvelteOptionStore = OptionStore<OptionValue>
export type SvelteCollectionStore = CollectionStore<JsonValue>

export interface SvelteFieldRendererProps<
  TValues extends object = Record<string, unknown>,
  TPath extends SvelteFieldPath<TValues> = SvelteFieldPath<TValues>,
> {
  readonly definition: SvelteFieldDefinition<TValues, TPath>
  readonly executeAction?: (actionId: string) => void
  readonly form: SvelteFormStore<TValues>
  readonly optionStore?: SvelteOptionStore
  readonly collectionStore?: SvelteCollectionStore
  readonly uploadStore?: UploadStore
  readonly registry?: SvelteComponentRegistry
  readonly panelId?: string
  readonly requestedFrom?: string
}

export interface SvelteCustomFieldProps<
  TValues extends object = Record<string, unknown>,
  TPath extends SvelteFieldPath<TValues> = SvelteFieldPath<TValues>,
> extends SvelteFieldRendererProps<TValues, TPath> {
  readonly value: SvelteFieldValue<TValues, TPath>
  readonly errors: readonly string[]
  readonly disabled: boolean
  readonly readOnly: boolean
  readonly required: boolean
  readonly inputId: string
  readonly setValue: (value: SvelteFieldValue<TValues, TPath>) => void
}

export interface SvelteEditorProps extends Record<string, unknown> {
  readonly value: JsonValue
  readonly disabled: boolean
  readonly readOnly: boolean
  readonly label: string
  readonly inputId: string
  readonly describedBy?: string
  readonly errorMessageId?: string
  readonly invalid: boolean
  readonly setValue: (value: JsonValue) => void
}
