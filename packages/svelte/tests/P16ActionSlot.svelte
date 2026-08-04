<script lang="ts">
  let { message = 'Action slot' }: { readonly message?: string } = $props()
</script>

<span data-action-slot>{message}</span>
