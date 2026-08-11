<script lang="ts">
  import Button from '../components/Button.svelte'
  import Input from '../components/Input.svelte'
  import Select from '../components/Select.svelte'
  import type { NavigationKey } from '@holo-js/panels-client'
  import { toSvelteSnapshot } from '../stores'
  import type { SvelteNavigationSearchRendererProps } from './contracts'

  let { shell }: { readonly shell: SvelteNavigationSearchRendererProps } = $props()
  const navigation = $derived.by(() => toSvelteSnapshot(shell.navigation))
  const search = $derived.by(() => toSvelteSnapshot(shell.search))
  const navigationKeys: readonly NavigationKey[] = ['ArrowDown', 'ArrowUp', 'End', 'Enter', 'Escape', 'Home']

  function shortcut(event: KeyboardEvent): void {
    if (!shell.search.shortcut(event.key, { alt: event.altKey, ctrl: event.ctrlKey, meta: event.metaKey, shift: event.shiftKey })) return
    event.preventDefault()
  }

  function navigateKey(event: KeyboardEvent): void {
    if (!navigationKeys.includes(event.key as NavigationKey)) return
    const url = shell.navigation.key(event.key as NavigationKey)
    if (url) shell.onNavigate?.(url)
    event.preventDefault()
  }

  function searchKey(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') shell.search.move(event.key === 'ArrowDown' ? 1 : -1)
    else if (event.key === 'Enter') {
      const url = shell.search.selectedUrl()
      if (url) shell.onNavigate?.(url)
    } else if (event.key === 'Escape') shell.search.close()
  }
</script>

<svelte:window onkeydown={shortcut} />

<div class={`hp-navigation-search hp-navigation-search--${$navigation.manifest.layout}`} data-panels-component="navigation-search">
  <Button aria-expanded={$navigation.menuOpen} aria-label="Toggle navigation" type="button" onclick={() => shell.navigation.toggleMenu()}>Menu</Button>
  {#if $navigation.manifest.panels.length > 1}
    <label>Panel<Select aria-label="Panel" value={$navigation.manifest.panelId} onchange={(event) => shell.onNavigate?.(shell.navigation.switchPanel(event.currentTarget.value))}>{#each $navigation.manifest.panels as panel (panel.id)}<option value={panel.id}>{panel.label}</option>{/each}</Select></label>
  {/if}
  <nav aria-label="Panel navigation" hidden={!$navigation.menuOpen && $navigation.manifest.layout === 'sidebar'}>
    {#each $navigation.manifest.groups as group (group.id)}<Button aria-expanded={!$navigation.collapsedGroups.has(group.id)} type="button" onclick={() => shell.navigation.toggleGroup(group.id)}>{group.label}</Button>{/each}
    {#each $navigation.manifest.clusters as cluster (cluster.id)}<Button aria-expanded={!$navigation.collapsedClusters.has(cluster.id)} type="button" onclick={() => shell.navigation.toggleCluster(cluster.id)}>{cluster.label}</Button>{/each}
    <ul>
      {#each shell.navigation.visibleItems as item (item.id)}
        <li data-cluster={item.cluster} data-group={item.group} data-parent={item.parent}>
          <a aria-current={item.id === $navigation.focusedItemId || item.active ? 'page' : undefined} href={item.path} tabindex={item.id === $navigation.focusedItemId ? 0 : -1} onclick={(event) => { if (shell.onNavigate) { event.preventDefault(); shell.onNavigate(item.path) } }} onkeydown={navigateKey}>
            {#if item.icon}<span aria-hidden="true" data-icon={item.icon}></span>{/if}{item.label}{#if item.badge}<span>{item.badge}</span>{/if}{#if item.variant}<small>{item.variant}</small>{/if}
          </a>
        </li>
      {/each}
    </ul>
  </nav>
  <div class="hp-global-search" role="search">
    <label>Global search<Input aria-controls="hp-global-search-results" aria-expanded={$search.open} placeholder="Search…" role="combobox" value={$search.term} onfocus={() => shell.search.open()} oninput={(event) => shell.search.input(event.currentTarget.value)} onkeydown={searchKey} /></label>
    <kbd>⌘/Ctrl K</kbd>
    {#if $search.loading}<span aria-live="polite" role="status">Searching…</span>{/if}
    {#if $search.error}<span role="alert">{$search.error}</span>{/if}
    <ul id="hp-global-search-results" role="listbox">
      {#each $search.results as result, index (`${result.resourceId}:${result.id}`)}
        <li aria-selected={index === $search.selectedIndex} role="option">
          <a href={result.url}>{#if result.image}<img alt="" src={result.image} />{/if}{#if result.icon}<span aria-hidden="true" data-icon={result.icon}></span>{/if}<strong>{result.title}</strong>{#each Object.entries(result.details) as [label, value] (label)}<span>{label}: {value}</span>{/each}</a>
          {#each result.actions as action (action.id)}<a href={action.url}>{action.label}</a>{/each}
        </li>
      {/each}
    </ul>
  </div>
</div>
