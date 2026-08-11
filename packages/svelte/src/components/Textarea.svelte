<script lang="ts">
  import type { HTMLTextareaAttributes } from 'svelte/elements'
  let { class: className = '', value = $bindable(), ...attributes }: HTMLTextareaAttributes = $props()
</script>

<textarea {...attributes} bind:value class={className} data-slot="textarea"></textarea>
