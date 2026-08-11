<script lang="ts">
  import type { Snippet } from 'svelte'
  export interface InputControlAttributes { 'aria-describedby'?: string; 'aria-invalid'?: true; id: string }
  interface Props { children?: Snippet<[InputControlAttributes]>; description?: string; error?: string; inputId: string; label: string; required?: boolean }
  let { children, description, error, inputId, label, required = false }: Props = $props()
  const describedBy = $derived([description ? `${inputId}-description` : undefined, error ? `${inputId}-error` : undefined].filter(Boolean).join(' ') || undefined)
  const control = $derived<InputControlAttributes>({ 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined, id: inputId })
</script>

<div class="hp-input-wrapper" data-panels-component="input-wrapper" data-slot="field">
  <label data-slot="label" for={inputId}>{label}{#if required}<span aria-hidden="true"> *</span>{/if}</label>
  {#if description}<div data-slot="field-description" id="{inputId}-description">{description}</div>{/if}
  {@render children?.(control)}
  {#if error}<div data-slot="field-error" id="{inputId}-error" role="alert">{error}</div>{/if}
</div>
