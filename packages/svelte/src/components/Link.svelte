<script lang="ts">
  import type { Snippet } from 'svelte'
  interface Props { children?: Snippet; current?: boolean; disabled?: boolean; href: string }
  let { children, current = false, disabled = false, href }: Props = $props()
</script>

<a {href} aria-current={current ? 'page' : undefined} aria-disabled={disabled || undefined} class="hp-link" data-panels-component="link" onclick={event => disabled && event.preventDefault()} tabindex={disabled ? -1 : undefined}>{@render children?.()}</a>
