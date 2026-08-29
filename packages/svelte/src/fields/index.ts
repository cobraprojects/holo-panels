import type { Component } from 'svelte'
import RawBasicField from './BasicField.svelte'
import RawChoiceField from './ChoiceField.svelte'
import RawCollectionField from './CollectionField.svelte'
import RawCustomField from './CustomField.svelte'
import RawDefaultEditor from './DefaultEditor.svelte'
import RawFieldFrame from './FieldFrame.svelte'
import RawFieldRenderer from './FieldRenderer.svelte'
import RawUploadField from './UploadField.svelte'
import RawResourceForm from './ResourceForm.svelte'
import type { SvelteEditorProps, SvelteFieldFrameProps, SvelteFieldRendererProps } from './contracts'

export const BasicField: Component<SvelteFieldRendererProps> = RawBasicField
export const ChoiceField: Component<SvelteFieldRendererProps> = RawChoiceField
export const CollectionField: Component<SvelteFieldRendererProps> = RawCollectionField
export const CustomField: Component<SvelteFieldRendererProps> = RawCustomField
export const DefaultEditor: Component<SvelteEditorProps> = RawDefaultEditor
export const FieldFrame: Component<SvelteFieldFrameProps> = RawFieldFrame
export const FieldRenderer: Component<SvelteFieldRendererProps> = RawFieldRenderer
export const UploadField: Component<SvelteFieldRendererProps> = RawUploadField
export const ResourceForm = RawResourceForm
export type {
  FieldControlAttributes,
  SvelteCollectionStore,
  SvelteCustomFieldProps,
  SvelteEditorProps,
  SvelteFieldDefinition,
  SvelteFieldFrameProps,
  SvelteFieldRendererProps,
  SvelteFormStore,
  SvelteOptionStore,
} from './contracts'
