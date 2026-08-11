<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements'
  let { class: className = '', type = 'text', value = $bindable(), ...attributes }: HTMLInputAttributes = $props()
  const slot = $derived(type === 'checkbox' ? 'checkbox' : type === 'radio' ? 'radio-group-item' : type === 'range' ? 'slider' : 'input')
</script>

{#if type === 'checkbox' || type === 'radio'}
  <input {...attributes} {type} {value} class={className} data-slot={slot} />
{:else}
  <input {...attributes} {type} bind:value class={className} data-slot={slot} />
{/if}
