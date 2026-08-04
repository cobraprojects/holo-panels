<script lang="ts">
  import DashboardRenderer from '../src/widgets/DashboardRenderer.svelte'
  import type { SvelteDashboardRendererProps } from '../src/widgets/contracts'

  let { dashboard }: { readonly dashboard: SvelteDashboardRendererProps } = $props()
</script>

<DashboardRenderer {...dashboard} />
