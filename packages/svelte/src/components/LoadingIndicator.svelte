<script lang="ts">
  interface Props { label?: string }
  let { label = 'Loading' }: Props = $props()
</script>

<span aria-label={label} aria-live="polite" class="hp-loading" data-panels-component="loading-indicator" role="status"></span>
