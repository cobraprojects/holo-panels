<script lang="ts">
  import type { SvelteFieldRendererProps } from './contracts'
  import BasicField from './BasicField.svelte'
  import ChoiceField from './ChoiceField.svelte'
  import CollectionField from './CollectionField.svelte'
  import CustomField from './CustomField.svelte'
  import UploadField from './UploadField.svelte'

  let props: SvelteFieldRendererProps = $props()
  const name = $derived(props.definition.type.split(':').at(-1) ?? '')
  const basic = new Set(['text', 'textarea', 'checkbox', 'toggle', 'radio', 'date', 'hidden', 'slider', 'color', 'slug'])
  const choices = new Set(['select', 'multiselect', 'checkbox-list', 'toggle-buttons'])
  const collections = new Set(['tags', 'key-value', 'code', 'markdown', 'rich-editor', 'repeater', 'builder'])
</script>

{#if basic.has(name)}
  <BasicField {...props} />
{:else if choices.has(name)}
  <ChoiceField {...props} />
{:else if name === 'upload'}
  <UploadField {...props} />
{:else if collections.has(name)}
  <CollectionField {...props} />
{:else}
  <CustomField {...props} />
{/if}
