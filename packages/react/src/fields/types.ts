import type { CollectionStore, EditorAdapterRegistry, FormPath, FormStore, FormValueAtPath, OptionStore, UploadStore } from '@holo-js/panels-client'
import type { ReactNode } from 'react'
import type { ComponentRegistry } from '../registry'

export interface ReactCompiledField<
  TValues extends object,
  TPath extends FormPath<TValues> = FormPath<TValues>,
> {
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

export interface ReactFieldRenderContext<
  TValues extends object,
  TPath extends FormPath<TValues> = FormPath<TValues>,
> {
  readonly definition: ReactCompiledField<TValues, TPath>
  readonly disabled: boolean
  readonly errors: readonly string[]
  readonly inputId: string
  readonly readOnly: boolean
  readonly value: FormValueAtPath<TValues, TPath>
}

export interface ReactFieldRendererProps<
  TValues extends object,
  TPath extends FormPath<TValues> = FormPath<TValues>,
> {
  readonly collectionStore?: CollectionStore<unknown>
  readonly createCollectionItem?: (blockType?: string) => unknown
  readonly definition: ReactCompiledField<TValues, TPath>
  readonly editorAdapters?: EditorAdapterRegistry
  readonly optionStore?: OptionStore<string | number>
  readonly panelId?: string
  readonly registry: ComponentRegistry
  readonly renderBuilderBlock?: (block: unknown, index: number) => ReactNode
  readonly renderRepeaterItem?: (value: unknown, index: number) => ReactNode
  readonly store: FormStore<TValues>
  readonly uploadStore?: UploadStore
}

export interface ReactFieldControlProps<
  TValues extends object,
  TPath extends FormPath<TValues> = FormPath<TValues>,
> extends ReactFieldRendererProps<TValues, TPath> {
  readonly context: ReactFieldRenderContext<TValues, TPath>
}
