<script lang="ts">
  import FieldRenderer from '../src/fields/FieldRenderer.svelte'
  import type { SvelteFormStore } from '../src/fields/contracts'

  let { form }: { readonly form: SvelteFormStore } = $props()
</script>

<FieldRenderer definition={{ type: 'text', path: 'secret', label: 'Secret', properties: { autocomplete: 'current-password', datalist: ['alpha', 'beta', 7], inputMode: 'password', mask: 'credential', prefix: '@', revealable: true, suffix: '.internal' } }} {form} />
<FieldRenderer definition={{ type: 'textarea', path: 'biography', label: 'Biography', properties: { autosize: true, maximumLength: 500, rows: 3 } }} {form} />
<FieldRenderer definition={{ type: 'toggle', path: 'enabled', label: 'Enabled', properties: { offLabel: 'Disabled', onLabel: 'Enabled' } }} {form} />
<FieldRenderer definition={{ type: 'date', path: 'date', label: 'Date', properties: { mode: 'date' } }} {form} />
<FieldRenderer definition={{ type: 'date', path: 'time', label: 'Time', properties: { mode: 'time' } }} {form} />
<FieldRenderer definition={{ type: 'date', path: 'dateTime', label: 'Date time', properties: { mode: 'date-time' } }} {form} />
