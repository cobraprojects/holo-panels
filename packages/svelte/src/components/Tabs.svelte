<script lang="ts">
  import { Tabs } from 'bits-ui'
  interface Tab { disabled?: boolean; id: string; label: string }
  interface Props { label: string; onselect?: (id: string) => void; tabs: readonly Tab[]; value: string }
  let { label, onselect, tabs, value = $bindable() }: Props = $props()

  function select(next: string): void {
    value = next
    onselect?.(next)
  }

</script>

<Tabs.Root class="hp-tabs" data-panels-component="tabs" data-slot="tabs" loop={true} onValueChange={select} {value}>
  <Tabs.List aria-label={label} data-slot="tabs-list">
    {#each tabs as tab (tab.id)}
      <Tabs.Trigger data-slot="tabs-trigger" disabled={tab.disabled} value={tab.id}>{tab.label}</Tabs.Trigger>
    {/each}
  </Tabs.List>
</Tabs.Root>
