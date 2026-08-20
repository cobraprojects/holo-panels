<script lang="ts">
  import { DropdownMenu } from 'bits-ui'
  import ChevronDown from 'lucide-svelte/icons/chevron-down'
  import { panelsPortalTarget } from '../portal'
  import Icon from './Icon.svelte'
  interface Item { disabled?: boolean; icon?: string | null; id: string; label: string }
  interface Props { ariaLabel?: string; items: readonly Item[]; label: string; onselect?: (id: string) => void; searchable?: boolean }
  let { ariaLabel, items, label, onselect, searchable = false }: Props = $props()
  let open = $state(false)
  let search = $state('')
  const portalTarget = panelsPortalTarget()
  const visibleItems = $derived(search ? items.filter(item => item.label.toLocaleLowerCase().includes(search.toLocaleLowerCase())) : items)
</script>

<div class="hp-dropdown" data-panels-component="dropdown">
  <DropdownMenu.Root bind:open>
    <DropdownMenu.Trigger aria-label={ariaLabel} class="hp-dropdown__trigger" data-slot="dropdown-menu-trigger">{label}<ChevronDown aria-hidden="true" /></DropdownMenu.Trigger>
    <DropdownMenu.Portal to={portalTarget()}>
      <DropdownMenu.Content align="end" class="hp-dropdown__menu" data-holo-panel="" data-slot="dropdown-menu-content" forceMount={true} loop={true} sideOffset={8}>
        {#if searchable}<input aria-label="Search tenants" bind:value={search} data-slot="input" placeholder="Search tenants…" />{/if}
        {#each visibleItems as item (item.id)}
          <DropdownMenu.Item data-slot="dropdown-menu-item" disabled={item.disabled} onSelect={() => onselect?.(item.id)} textValue={item.label}>{#if item.icon}<Icon name={item.icon} />{/if}{item.label}</DropdownMenu.Item>
        {/each}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>
</div>
