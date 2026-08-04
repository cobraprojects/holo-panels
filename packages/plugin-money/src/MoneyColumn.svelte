<script lang="ts">
  let { currency, locale = null, value }: { currency: string, locale?: string | null, value: number } = $props()
  const formatted = $derived(new Intl.NumberFormat(locale ?? undefined, { currency, style: 'currency' }).format(value))
</script>

<span class="hp-money-column">{formatted}</span>
