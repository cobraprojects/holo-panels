<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements'
  let { class: className = '', type = 'text', value = $bindable(), ...attributes }: HTMLInputAttributes = $props()
  const slot = $derived(type === 'checkbox' ? 'checkbox' : type === 'radio' ? 'radio-group-item' : type === 'range' ? 'slider' : 'input')
</script>

<input {...attributes} {type} {value} class={className} data-slot={slot} />
