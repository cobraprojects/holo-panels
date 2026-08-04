import { describe, expect, it } from 'vitest'
import { nextNavigationSearchAcceptanceFixture } from '../../../apps/example-next/tests/p11-navigation-search-acceptance-next'
import { nuxtNavigationSearchAcceptanceFixture } from '../../../apps/example-nuxt/tests/p11-navigation-search-acceptance-nuxt'
import { svelteKitNavigationSearchAcceptanceFixture } from '../../../apps/example-sveltekit/tests/p11-navigation-search-acceptance-sveltekit'
import { runNavigationSearchAcceptanceJourney } from '../src/navigation-search-acceptance'

describe('P11 navigation and global-search phase gate', () => {
  it('renders and exercises the same authorized navigation and search journey in every example app', async () => {
    for (const fixture of [nextNavigationSearchAcceptanceFixture, nuxtNavigationSearchAcceptanceFixture, svelteKitNavigationSearchAcceptanceFixture]) {
      const report = await runNavigationSearchAcceptanceJourney(fixture)

      expect(report.framework).toBe(fixture.framework)
      expect(report.render.ssrStable).toBe(true)
      expect(report.render.markup).toContain('data-panels-component="navigation-search"')
      expect(report.render.markup).toContain('aria-label="Panel navigation"')
      expect(report.render.markup).toContain('Publishing')
      expect(report.render.markup).toContain('Content')
      expect(report.render.markup).toContain('Archived posts')
      expect(report.render.markup).toContain('role="combobox"')
      expect(report.render.markup).toContain('role="listbox"')
      expect(report.render.markup).toContain('Cairo guide')
      expect(report.render.markup).toContain('Engineering notes')
      expect(report.render.markup).toContain('Amina')
      expect(report.render.markup).toContain('/admin/posts/1/edit')
      expect(report.searchResultTitles).toEqual(['Cairo guide', 'Engineering notes'])
      expect(report.collapsedItems).toEqual(['dashboard'])
      expect(report.activePath).toBe('/admin/archive')
      expect(report.panelPath).toBe('/vendor')
    }
  })
})
