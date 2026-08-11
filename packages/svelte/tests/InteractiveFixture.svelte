<script lang="ts">
  import { PanelsDropdown, PanelsTabs } from '../src/components'

  interface Props { onselect?: (id: string) => void }
  let { onselect }: Props = $props()
</script>

<PanelsDropdown items={[{ id: 'edit', label: 'Edit' }, { id: 'delete', label: 'Delete' }]} label="Actions" {onselect} />
<PanelsTabs label="Content" tabs={[{ id: 'one', label: 'One' }, { id: 'two', label: 'Two' }]} value="one" />
