<script lang="ts">
  import type { ClientRelationOption } from '@holo-js/panels-client'
  import RelationManagerRenderer from '../src/relations/RelationManagerRenderer.svelte'
  import type { SvelteRelationOperationRequest } from '../src/relations/contracts'

  let { loadOptions, onOperation }: {
    readonly loadOptions: (managerId: string, search: string) => Promise<readonly ClientRelationOption[]>
    readonly onOperation: (request: SvelteRelationOperationRequest) => void | Promise<void>
  } = $props()
</script>

<RelationManagerRenderer relations={{
  loadOptions,
  managers: [{ badge: 0, columns: [{ key: 'name', label: 'Name' }], group: null, id: 'tags', label: 'Tags', operations: ['attach'], pivotFields: [{ id: 'position', label: 'Position', required: false, type: 'number' }], presentation: 'inline', records: [], url: null, visible: true }],
  onOperation,
}} />
