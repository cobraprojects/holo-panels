<script lang="ts">
  import type { FieldControlAttributes, SvelteFieldFrameProps } from './contracts'
  import Icon from '../components/Icon.svelte'

  let { actionPending, children, description, errors = [], executeAction, hint, hintAction, inputId, label, path, required = false, type }: SvelteFieldFrameProps = $props()
  const action = $derived(hintAction && typeof hintAction === 'object' && !Array.isArray(hintAction) && typeof hintAction.id === 'string' && typeof hintAction.label === 'string' && hintAction.visible !== false ? hintAction : null)
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

<div class="hp-field" data-field-path={path} data-field-type={type} data-panels-field={inputId}>
  <label for={inputId}>{label}{#if required}<span aria-hidden="true"> *</span>{/if}</label>
  {#if descriptionId}<div id={descriptionId}>{description ?? hint}</div>{/if}
  {#if action}<button class="hp-field-action" data-color={typeof action.color === 'string' ? action.color : undefined} disabled={action.disabled === true || actionPending?.(action.id as string) === true} title={typeof action.tooltip === 'string' ? action.tooltip : undefined} type="button" onclick={() => executeAction?.(action.id as string)}>{#if typeof action.icon === 'string'}<Icon name={action.icon} />{/if}<span>{action.label}</span></button>{/if}
  {@render children(attributes)}
  {#if errorId}<div id={errorId} role="alert">{errors.join(' ')}</div>{/if}
</div>
