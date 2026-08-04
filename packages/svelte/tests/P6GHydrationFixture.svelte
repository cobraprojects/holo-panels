<script lang="ts">
  import type { SvelteFormStore } from '../src/fields/contracts'
  import BasicField from '../src/fields/BasicField.svelte'

  let { form }: { form: SvelteFormStore } = $props()
</script>

<BasicField definition={{ type: 'text', path: 'title', label: 'Title', helperText: 'Public title', required: true }} {form} />
