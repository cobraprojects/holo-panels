<script lang="ts">
  let { currency, value }: { readonly currency: string, readonly value: unknown } = $props()
</script>

<span class="money">{currency} {String(value)}</span>
