<script lang="ts">
  import RelationManagerRenderer from '../src/relations/RelationManagerRenderer.svelte'
</script>

<RelationManagerRenderer relations={{
  managers: [{ badge: 1, columns: [{ key: 'name', label: 'Name' }], group: null, id: 'tags', label: 'Tags', operations: [], presentation: 'inline', records: [{ id: 'tag-typescript', values: { name: 'TypeScript' } }], url: null, visible: true }],
}} />
