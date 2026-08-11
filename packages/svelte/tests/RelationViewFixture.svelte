<script lang="ts">
  import RelationManagerRenderer from '../src/relations/RelationManagerRenderer.svelte'
  import type { SvelteRelationOperationRequest } from '../src/relations/contracts'

  let { onOperation }: {
    readonly onOperation: (request: SvelteRelationOperationRequest) => void | Promise<void>
  } = $props()
</script>

<RelationManagerRenderer relations={{
  managers: [{ badge: 1, columns: [{ key: 'name', label: 'Name' }], group: null, id: 'tags', label: 'Tags', operations: ['view'], presentation: 'inline', records: [{ id: 'tag-typescript', values: { name: 'TypeScript' } }], url: null, visible: true }],
  onOperation,
}} />
