<script lang="ts">
  import type { JsonObject } from '@holo-js/panels-core'

  let { data, scopes, title }: { readonly data: JsonObject, readonly scopes: readonly string[], readonly title: string } = $props()
</script>

<strong data-record={String(data.recordId)} data-scope={scopes.join(':')}>{title}</strong>
