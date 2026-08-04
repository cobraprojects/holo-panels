<script lang="ts">
  let {
    message,
    schemaComponentId,
    schemaStatePath,
  }: {
    readonly message?: string
    readonly schemaComponentId: string
    readonly schemaStatePath?: string
  } = $props()
</script>

<output data-custom-id={schemaComponentId} data-custom-state={schemaStatePath}>{message}</output>
