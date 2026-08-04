<script lang="ts">
  import type { FieldControlAttributes, SvelteFieldFrameProps } from './contracts'

  let { children, description, errors = [], hint, inputId, label, required = false }: SvelteFieldFrameProps = $props()
  const descriptionId = $derived(description || hint ? `${inputId}-description` : undefined)
  const errorId = $derived(errors.length > 0 ? `${inputId}-error` : undefined)
  const describedBy = $derived([descriptionId, errorId].filter(Boolean).join(' ') || undefined)
  const attributes = $derived<FieldControlAttributes>({
    'aria-describedby': describedBy,
    'aria-errormessage': errorId,
    'aria-invalid': errorId ? true : undefined,
    id: inputId,
  })
</script>

<div class="hp-field" data-panels-field={inputId}>
  <label for={inputId}>{label}{#if required}<span aria-hidden="true"> *</span>{/if}</label>
  {#if descriptionId}<div id={descriptionId}>{description ?? hint}</div>{/if}
  {@render children(attributes)}
  {#if errorId}<div id={errorId} role="alert">{errors.join(' ')}</div>{/if}
</div>
