<script lang="ts">
  import type { JsonObject } from '@holo-js/panels-svelte'

  let { properties }: { properties: JsonObject } = $props()
</script>

<div><p>{String(properties.message ?? '')}</p><details><summary>Publishing details</summary><p>{String(properties.detail ?? '')}</p></details></div>
