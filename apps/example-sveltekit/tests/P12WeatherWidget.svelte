<script lang="ts">
  import type { JsonObject } from '@holo-js/panels-client'

  let { properties }: { readonly properties: JsonObject, readonly widgetId: string } = $props()
</script>

<p data-custom-widget="weather">{String(properties.forecast)}</p>
