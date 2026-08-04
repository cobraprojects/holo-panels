<script lang="ts">
  interface Props { alt: string; fallback?: string; src?: string }
  let { alt, fallback, src }: Props = $props()
</script>

<span class="hp-avatar" data-panels-component="avatar">
  {#if src}<img {alt} {src} />{:else}<span aria-label={alt}>{fallback ?? alt.slice(0, 1).toUpperCase()}</span>{/if}
</span>
