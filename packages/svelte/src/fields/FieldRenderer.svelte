<script lang="ts">
  import type { SvelteFieldRendererProps } from './contracts'
  import CustomField from './CustomField.svelte'
  import { SvelteComponentRegistry } from '../registry'
  import { registerSvelteFieldRenderers } from './registry'

  let props: SvelteFieldRendererProps = $props()
  const fallbackRegistry = new SvelteComponentRegistry()
  const registry = $derived(registerSvelteFieldRenderers(props.registry ?? fallbackRegistry))
</script>

<CustomField {...props} {registry} />
