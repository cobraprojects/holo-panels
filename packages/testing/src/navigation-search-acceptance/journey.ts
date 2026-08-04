import { GlobalSearchStore, NavigationStore, type ClientNavigationManifest } from '@holo-js/panels-client'
import type { NavigationSearchAcceptanceFixture, NavigationSearchAcceptanceJourneyReport, NavigationSearchAcceptanceModel } from './contracts'

const manifest: ClientNavigationManifest = {
  activeItemId: 'posts',
  clusters: [{ active: true, collapsible: true, id: 'content', label: 'Content', sort: 20 }],
  collapsible: true,
  groups: [{ active: true, id: 'Publishing', label: 'Publishing', sort: 20 }],
  items: [
    { active: false, badge: null, cluster: null, group: null, icon: 'home', id: 'dashboard', kind: 'dashboard', label: 'Dashboard', parent: null, path: '/admin', sort: 10, variant: null },
    { active: true, badge: '2', cluster: 'content', group: 'Publishing', icon: 'document', id: 'posts', kind: 'resource', label: 'Posts', parent: null, path: '/admin/posts', sort: 20, variant: null },
    { active: false, badge: null, cluster: 'content', group: 'Publishing', icon: null, id: 'posts.archived', kind: 'resource', label: 'Archived posts', parent: 'posts', path: '/admin/archive', sort: 30, variant: 'Archived' },
  ],
  layout: 'sidebar',
  panelId: 'admin',
  panels: [
    { active: true, icon: null, id: 'admin', label: 'Admin', path: '/admin', sort: 10 },
    { active: false, icon: null, id: 'vendor', label: 'Vendor', path: '/vendor', sort: 20 },
  ],
}

async function model(): Promise<NavigationSearchAcceptanceModel> {
  const navigation = new NavigationStore(manifest, 1280)
  const search = new GlobalSearchStore({
    async search(term) {
      return {
        panelId: 'admin',
        results: [
          { actions: [{ id: 'edit', label: 'Edit', url: '/admin/posts/1/edit' }], details: { Author: 'Amina' }, icon: 'document', id: '1', image: null, resourceId: 'posts', title: `${term} guide`, url: '/admin/posts/1' },
          { actions: [], details: { Author: 'Omar' }, icon: null, id: '2', image: '/media/post-2.png', resourceId: 'posts', title: 'Engineering notes', url: '/admin/posts/2' },
        ],
        term,
      }
    },
  }, { debounceMilliseconds: 0, minimumLength: 2 })
  search.shortcut('k', { ctrl: true, meta: false })
  search.input('Cairo')
  await new Promise(resolve => setTimeout(resolve, 0))
  await Promise.resolve()
  return { navigation, search }
}

export async function runNavigationSearchAcceptanceJourney(fixture: NavigationSearchAcceptanceFixture): Promise<NavigationSearchAcceptanceJourneyReport> {
  const current = await model()
  const render = await fixture.render(current)
  current.navigation.toggleGroup('Publishing')
  const collapsedItems = current.navigation.visibleItems.map(item => item.id)
  current.navigation.toggleGroup('Publishing')
  current.navigation.key('ArrowDown')
  current.navigation.key('ArrowDown')
  return {
    activePath: current.navigation.key('Enter'),
    collapsedItems,
    framework: fixture.framework,
    panelPath: current.navigation.switchPanel('vendor'),
    render,
    searchResultTitles: current.search.snapshot.results.map(result => result.title),
  }
}
