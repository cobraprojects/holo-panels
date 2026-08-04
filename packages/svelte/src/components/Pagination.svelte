<script lang="ts">
  interface Props { label?: string; onpagechange?: (page: number) => void; page: number; pages: number }
  let { label = 'Pagination', onpagechange, page, pages }: Props = $props()
  const validPages = $derived(Number.isSafeInteger(pages) && pages > 0 ? pages : 1)
  const current = $derived(Math.min(Math.max(1, page), validPages))
</script>

<nav aria-label={label} class="hp-pagination" data-panels-component="pagination">
  <button aria-label="Previous page" disabled={current <= 1} onclick={() => onpagechange?.(current - 1)} type="button">Previous</button>
  <span aria-live="polite">Page {current} of {validPages}</span>
  <button aria-label="Next page" disabled={current >= validPages} onclick={() => onpagechange?.(current + 1)} type="button">Next</button>
</nav>
