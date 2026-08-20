<script lang="ts">
  import { PanelsModal, PanelsSlideOver } from '../src/components'
  import { setPanelsPortalTarget } from '../src/portal'

  interface Props { target: HTMLElement }
  let { target }: Props = $props()
  setPanelsPortalTarget(() => target)
</script>

<div data-portal-fixture="">
  <PanelsModal labelledBy="portal-modal-title" onclose={() => undefined} open={true} />
  <PanelsSlideOver labelledBy="portal-drawer-title" onclose={() => undefined} open={true} />
</div>
