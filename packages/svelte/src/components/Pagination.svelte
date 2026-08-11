<script lang="ts">
  import Button from './Button.svelte'
  interface Props { label?: string; onpagechange?: (page: number) => void; page: number; pages: number }
  let { label = 'Pagination', onpagechange, page, pages }: Props = $props()
  const validPages = $derived(Number.isSafeInteger(pages) && pages > 0 ? pages : 1)
  const current = $derived(Math.min(Math.max(1, page), validPages))
</script>

<nav aria-label={label} class="hp-pagination" data-panels-component="pagination" data-slot="pagination">
  <Button aria-label="Previous page" data-slot="pagination-link" data-variant="outline" disabled={current <= 1} onclick={() => onpagechange?.(current - 1)} type="button">Previous</Button>
  <span aria-live="polite" data-slot="pagination-status">Page {current} of {validPages}</span>
  <Button aria-label="Next page" data-slot="pagination-link" data-variant="outline" disabled={current >= validPages} onclick={() => onpagechange?.(current + 1)} type="button">Next</Button>
</nav>
