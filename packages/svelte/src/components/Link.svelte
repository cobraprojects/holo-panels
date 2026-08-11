<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { HTMLAnchorAttributes } from 'svelte/elements'
  interface Props extends HTMLAnchorAttributes { children?: Snippet; current?: boolean; disabled?: boolean; href: string }
  let { children, class: className = '', current = false, disabled = false, href, onclick, ...attributes }: Props = $props()
</script>

<a {...attributes} {href} aria-current={current ? 'page' : undefined} aria-disabled={disabled || undefined} class={`hp-link ${className}`.trim()} data-panels-component="link" data-slot={attributes['data-slot'] ?? 'button'} data-variant="link" onclick={event => {
  if (disabled) event.preventDefault()
  else onclick?.(event)
}} tabindex={disabled ? -1 : undefined}>{@render children?.()}</a>
