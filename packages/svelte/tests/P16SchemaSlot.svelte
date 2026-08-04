<script lang="ts">
  let {
    schemaComponentId,
  }: {
    readonly schemaComponentId: string
  } = $props()
</script>

<span data-slot-owner={schemaComponentId}>Registered slot</span>
