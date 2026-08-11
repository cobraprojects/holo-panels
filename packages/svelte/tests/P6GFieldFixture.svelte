<script lang="ts">
  import type { CollectionStore, JsonValue, OptionStore, OptionValue, UploadStore } from '@holo-js/panels-client'
  import { SvelteComponentRegistry } from '../src/registry'
  import type { SvelteFormStore } from '../src/fields/contracts'
  import FieldRenderer from '../src/fields/FieldRenderer.svelte'
  import P6GCustomField from './P6GCustomField.svelte'
  import P6GEditor from './P6GEditor.svelte'

  interface Props {
    form: SvelteFormStore
    optionStore: OptionStore<OptionValue>
    collectionStore: CollectionStore<JsonValue>
    uploadStore: UploadStore
  }

  let { form, optionStore, collectionStore, uploadStore }: Props = $props()
  const registry = new SvelteComponentRegistry()
  registry.register({ component: P6GCustomField, source: 'P6GFieldFixture.svelte', typeId: 'field.acme.field.rating' })
  registry.register({ component: P6GEditor, source: 'P6GFieldFixture.svelte', typeId: 'panels:editor:test-editor' })
  const basicTypes = ['text', 'textarea', 'checkbox', 'toggle', 'radio', 'date', 'hidden', 'slider', 'color', 'slug']
  const optionTypes = ['select', 'multiselect', 'checkbox-list', 'toggle-buttons']
  const collectionTypes = ['tags', 'key-value', 'code', 'markdown', 'rich-editor']
</script>

{#each basicTypes as type}
  <FieldRenderer definition={{ type, path: `basic.${type}`, label: `Basic ${type}`, required: type === 'text', helperText: type === 'text' ? 'Public title' : undefined }} {form} {registry} />
{/each}
{#each optionTypes as type}
  <FieldRenderer definition={{ type, path: `option.${type}`, label: `Option ${type}`, properties: { searchable: type === 'select' } }} {form} {optionStore} {registry} />
{/each}
{#each collectionTypes as type}
  <FieldRenderer definition={{ type, path: `collection.${type}`, label: `Collection ${type}`, properties: type === 'rich-editor' ? { editorAdapter: 'test-editor' } : {} }} {form} {registry} />
{/each}
<FieldRenderer definition={{ type: 'repeater', path: 'sections', label: 'Sections', properties: { cloneable: true, collapsible: true, fields: [{ label: 'Title', path: 'title', required: true, type: 'text' }] } }} {form} {collectionStore} {registry} />
<FieldRenderer definition={{ type: 'builder', path: 'builder', label: 'Builder', properties: { cloneable: true } }} {form} {collectionStore} {registry} />
<FieldRenderer definition={{ type: 'panels:field:upload', path: 'attachment', label: 'Attachment', required: true }} {form} {uploadStore} {registry} />
<FieldRenderer definition={{ type: 'acme:field:rating', path: 'rating', label: 'Rating' }} {form} {registry} panelId="admin" requestedFrom="P6GFieldFixture.svelte" />
