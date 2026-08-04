import type { NavigationKey } from '@holo-js/panels-client'
import { useEffect, type KeyboardEvent, type ReactNode } from 'react'
import { usePanelsStore } from '../store'
import type { ReactNavigationSearchRendererProps } from './types'

const navigationKeys: readonly NavigationKey[] = ['ArrowDown', 'ArrowUp', 'End', 'Enter', 'Escape', 'Home']

export function ReactNavigationSearchRenderer(props: ReactNavigationSearchRendererProps): ReactNode {
  const navigation = usePanelsStore({ subscribe: listener => props.navigation.subscribe(listener), getSnapshot: () => props.navigation.snapshot })
  const search = usePanelsStore({ subscribe: listener => props.search.subscribe(listener), getSnapshot: () => props.search.snapshot })
  useEffect(() => {
    const keydown = (event: globalThis.KeyboardEvent): void => {
      if (!props.search.shortcut(event.key, { ctrl: event.ctrlKey, meta: event.metaKey })) return
      event.preventDefault()
    }
    globalThis.addEventListener?.('keydown', keydown)
    return () => globalThis.removeEventListener?.('keydown', keydown)
  }, [props.search])
  const keyNavigation = (event: KeyboardEvent<HTMLElement>): void => {
    if (!navigationKeys.includes(event.key as NavigationKey)) return
    const url = props.navigation.key(event.key as NavigationKey)
    if (url) props.onNavigate?.(url)
    event.preventDefault()
  }
  const keySearch = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') props.search.move(event.key === 'ArrowDown' ? 1 : -1)
    else if (event.key === 'Enter') {
      const url = props.search.selectedUrl()
      if (url) props.onNavigate?.(url)
    } else if (event.key === 'Escape') props.search.close()
  }
  return <div className={`hp-navigation-search hp-navigation-search--${navigation.manifest.layout}`} data-panels-component="navigation-search">
    <button aria-expanded={navigation.menuOpen} aria-label="Toggle navigation" onClick={() => props.navigation.toggleMenu()} type="button">Menu</button>
    {navigation.manifest.panels.length > 1 ? <label>Panel<select aria-label="Panel" onChange={event => props.onNavigate?.(props.navigation.switchPanel(event.currentTarget.value))} value={navigation.manifest.panelId}>{navigation.manifest.panels.map(panel => <option key={panel.id} value={panel.id}>{panel.label}</option>)}</select></label> : null}
    <nav aria-label="Panel navigation" hidden={!navigation.menuOpen && navigation.manifest.layout === 'sidebar'} onKeyDown={keyNavigation}>
      {navigation.manifest.groups.map(group => <button aria-expanded={!navigation.collapsedGroups.has(group.id)} key={group.id} onClick={() => props.navigation.toggleGroup(group.id)} type="button">{group.label}</button>)}
      {navigation.manifest.clusters.map(cluster => <button aria-expanded={!navigation.collapsedClusters.has(cluster.id)} key={cluster.id} onClick={() => props.navigation.toggleCluster(cluster.id)} type="button">{cluster.label}</button>)}
      <ul>{props.navigation.visibleItems.map(item => <li data-cluster={item.cluster} data-group={item.group} data-parent={item.parent} key={item.id}><a aria-current={item.id === navigation.focusedItemId || item.active ? 'page' : undefined} href={item.path} onClick={event => { if (props.onNavigate) { event.preventDefault(); props.onNavigate(item.path) } }} tabIndex={item.id === navigation.focusedItemId ? 0 : -1}>{item.icon ? <span aria-hidden="true" data-icon={item.icon} /> : null}{item.label}{item.badge ? <span>{item.badge}</span> : null}{item.variant ? <small>{item.variant}</small> : null}</a></li>)}</ul>
    </nav>
    <div className="hp-global-search" role="search">
      <label>Global search<input aria-controls="hp-global-search-results" aria-expanded={search.open} onChange={event => props.search.input(event.currentTarget.value)} onFocus={() => props.search.shortcut('k', { ctrl: true, meta: false })} onKeyDown={keySearch} placeholder="Search…" role="combobox" value={search.term} /></label>
      <kbd>⌘/Ctrl K</kbd>
      {search.loading ? <span aria-live="polite" role="status">Searching…</span> : null}
      {search.error ? <span role="alert">{search.error}</span> : null}
      <ul id="hp-global-search-results" role="listbox">{search.results.map((result, index) => <li aria-selected={index === search.selectedIndex} key={`${result.resourceId}:${result.id}`} role="option"><a href={result.url}>{result.image ? <img alt="" src={result.image} /> : null}{result.icon ? <span aria-hidden="true" data-icon={result.icon} /> : null}<strong>{result.title}</strong>{Object.entries(result.details).map(([label, value]) => <span key={label}>{label}: {value}</span>)}</a>{result.actions.map(action => <a href={action.url} key={action.id}>{action.label}</a>)}</li>)}</ul>
    </div>
  </div>
}
