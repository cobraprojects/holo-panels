<script lang="ts">
  interface Props { alt: string; fallback?: string; src?: string }
  let { alt, fallback, src }: Props = $props()
</script>

<span class="hp-avatar" data-panels-component="avatar" data-slot="avatar">
  {#if src}<img {alt} {src} data-slot="avatar-image" />{:else}<span aria-label={alt} data-slot="avatar-fallback">{fallback ?? alt.slice(0, 1).toUpperCase()}</span>{/if}
</span>
