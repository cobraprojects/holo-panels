import { ShadcnButton, ShadcnInput, ShadcnSelect } from '../internal-ui'
import type { NavigationKey } from '@holo-js/panels-client'
import { defineComponent, h, onBeforeUnmount, onMounted, type PropType, type VNodeChild } from 'vue'
import { usePanelsStore } from '../stores'
import type { VueNavigationSearchRendererProps } from './types'

const navigationKeys: readonly NavigationKey[] = ['ArrowDown', 'ArrowUp', 'End', 'Enter', 'Escape', 'Home']

function target<TElement extends EventTarget>(event: Event): TElement {
  return event.currentTarget as TElement
}

export const VueNavigationSearchRenderer = defineComponent({
  name: 'VueNavigationSearchRenderer',
  props: {
    shell: { type: Object as PropType<VueNavigationSearchRendererProps>, required: true },
  },
  setup(componentProps) {
    const navigation = usePanelsStore({
      snapshot: componentProps.shell.navigation.snapshot,
      subscribe: listener => componentProps.shell.navigation.subscribe(state => listener(state, state)),
    })
    const search = usePanelsStore({
      snapshot: componentProps.shell.search.snapshot,
      subscribe: listener => componentProps.shell.search.subscribe(state => listener(state, state)),
    })
    const shortcut = (event: KeyboardEvent): void => {
      if (!componentProps.shell.search.shortcut(event.key, { alt: event.altKey, ctrl: event.ctrlKey, meta: event.metaKey, shift: event.shiftKey })) return
      event.preventDefault()
    }
    onMounted(() => globalThis.addEventListener?.('keydown', shortcut))
    onBeforeUnmount(() => globalThis.removeEventListener?.('keydown', shortcut))
    const navigateKey = (event: KeyboardEvent): void => {
      if (!navigationKeys.includes(event.key as NavigationKey)) return
      const url = componentProps.shell.navigation.key(event.key as NavigationKey)
      if (url) componentProps.shell.onNavigate?.(url)
      event.preventDefault()
    }
    const searchKey = (event: KeyboardEvent): void => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') componentProps.shell.search.move(event.key === 'ArrowDown' ? 1 : -1)
      else if (event.key === 'Enter') {
        const url = componentProps.shell.search.selectedUrl()
        if (url) componentProps.shell.onNavigate?.(url)
      } else if (event.key === 'Escape') componentProps.shell.search.close()
    }
    return (): VNodeChild => {
      const state = navigation.value
      const results = search.value
      return h('div', { class: ['hp-navigation-search', `hp-navigation-search--${state.manifest.layout}`], 'data-panels-component': 'navigation-search' }, [
        h(ShadcnButton, { 'aria-expanded': state.menuOpen, 'aria-label': 'Toggle navigation', type: 'button', onClick: () => componentProps.shell.navigation.toggleMenu() }, 'Menu'),
        state.manifest.panels.length > 1 ? h('label', ['Panel', h(ShadcnSelect, { 'aria-label': 'Panel', value: state.manifest.panelId, onChange: (event: Event) => componentProps.shell.onNavigate?.(componentProps.shell.navigation.switchPanel(target<HTMLSelectElement>(event).value)) }, state.manifest.panels.map(panel => h('option', { key: panel.id, value: panel.id }, panel.label)))]) : null,
        h('nav', { 'aria-label': 'Panel navigation', hidden: !state.menuOpen && state.manifest.layout === 'sidebar', onKeydown: navigateKey }, [
          ...state.manifest.groups.map(group => h(ShadcnButton, { 'aria-expanded': !state.collapsedGroups.has(group.id), key: group.id, type: 'button', onClick: () => componentProps.shell.navigation.toggleGroup(group.id) }, group.label)),
          ...state.manifest.clusters.map(cluster => h(ShadcnButton, { 'aria-expanded': !state.collapsedClusters.has(cluster.id), key: cluster.id, type: 'button', onClick: () => componentProps.shell.navigation.toggleCluster(cluster.id) }, cluster.label)),
          h('ul', componentProps.shell.navigation.visibleItems.map(item => h('li', { 'data-cluster': item.cluster, 'data-group': item.group, 'data-parent': item.parent, key: item.id }, h('a', {
            'aria-current': item.id === state.focusedItemId || item.active ? 'page' : undefined,
            href: item.path,
            tabindex: item.id === state.focusedItemId ? 0 : -1,
            onClick: (event: Event) => { if (componentProps.shell.onNavigate) { event.preventDefault(); componentProps.shell.onNavigate(item.path) } },
          }, [item.icon ? h('span', { 'aria-hidden': 'true', 'data-icon': item.icon }) : null, item.label, item.badge ? h('span', item.badge) : null, item.variant ? h('small', item.variant) : null])))),
        ]),
        h('div', { class: 'hp-global-search', role: 'search' }, [
          h('label', ['Global search', h(ShadcnInput, {
            'aria-controls': 'hp-global-search-results',
            'aria-expanded': results.open,
            placeholder: 'Search…',
            role: 'combobox',
            value: results.term,
            onFocus: () => componentProps.shell.search.open(),
            onInput: (event: Event) => componentProps.shell.search.input(target<HTMLInputElement>(event).value),
            onKeydown: searchKey,
          })]),
          h('kbd', '⌘/Ctrl K'),
          results.loading ? h('span', { 'aria-live': 'polite', role: 'status' }, 'Searching…') : null,
          results.error ? h('span', { role: 'alert' }, results.error) : null,
          h('ul', { id: 'hp-global-search-results', role: 'listbox' }, results.results.map((result, index) => h('li', { 'aria-selected': index === results.selectedIndex, key: `${result.resourceId}:${result.id}`, role: 'option' }, [
            h('a', { href: result.url }, [result.image ? h('img', { alt: '', src: result.image }) : null, result.icon ? h('span', { 'aria-hidden': 'true', 'data-icon': result.icon }) : null, h('strong', result.title), ...Object.entries(result.details).map(([label, value]) => h('span', { key: label }, `${label}: ${value}`))]),
            ...result.actions.map(action => h('a', { href: action.url, key: action.id }, action.label)),
          ]))),
        ]),
      ])
    }
  },
})
