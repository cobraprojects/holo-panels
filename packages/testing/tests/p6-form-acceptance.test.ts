import { describe, expect, it } from 'vitest'
import { nextFormAcceptanceFixture } from '../../../apps/example-next/tests/p6-form-acceptance-next'
import { nuxtFormAcceptanceFixture } from '../../../apps/example-nuxt/tests/p6-form-acceptance-nuxt'
import { svelteKitFormAcceptanceFixture } from '../../../apps/example-sveltekit/tests/p6-form-acceptance-sveltekit'
import { runFormAcceptanceJourney } from '../src/form-acceptance/index'

function reportAt<TReport extends { readonly stage: string }>(reports: readonly TReport[], stage: string): TReport {
  const report = reports.find(candidate => candidate.stage === stage)
  if (!report) throw new Error(`Missing acceptance render stage "${stage}"`)
  return report
}

describe.each([
  ['Next', nextFormAcceptanceFixture],
  ['Nuxt', nuxtFormAcceptanceFixture],
  ['SvelteKit', svelteKitFormAcceptanceFixture],
] as const)('P6 form acceptance in %s', (_name, fixture) => {
  it('renders the shared Create/Edit journey through the exported framework FieldRenderer', async () => {
    const report = await runFormAcceptanceJourney(fixture)

    expect(report.framework).toBe(fixture.framework)
    expect(report.slug).toEqual({ create: 'cairo-travel-guide', edit: 'updated-nile-guide' })
    expect(report.city).toEqual({
      clearedAfterCountryChange: true,
      loadedLabels: ['Cairo', 'Giza'],
      observedLoading: true,
    })
    expect(report.repeater.errorPathsAfterRemoval).toEqual(['0.heading'])
    expect(report.repeater.stableKeys).toHaveLength(1)
    expect(report.upload.observedProgress).toEqual([0.25, 1, 0.25, 1])
    expect(report.upload.orderedNames).toEqual(['map.png', 'cover.png'])
    expect(report.upload.previewUrls).toEqual(['/previews/map.png', '/previews/cover.png'])
    expect(report.upload.removedNames).toEqual(['cover.png'])
    expect(report.renderReports.every(render => render.framework === fixture.framework)).toBe(true)
    expect(report.renderReports.every(render => render.ssrStable)).toBe(true)

    const loading = reportAt(report.renderReports, 'city-loading').markup
    expect(loading).toContain('Loading')
    expect(loading).toContain('City')

    const progress = reportAt(report.renderReports, 'upload-progress').markup
    expect(progress).toContain('cover.png')
    expect(progress).toMatch(/<progress[^>]+value="0\.25"/u)
    expect(progress).toContain('Upload progress for cover.png')

    const reordered = reportAt(report.renderReports, 'upload-reordered').markup
    expect(reordered.indexOf('map.png')).toBeLessThan(reordered.indexOf('cover.png'))
    expect(reordered).toContain('/previews/map.png')
    expect(reordered).toContain('/previews/cover.png')

    const removed = reportAt(report.renderReports, 'upload-removed').markup
    expect(removed).toContain('map.png')
    expect(removed).not.toContain('cover.png')

    const create = reportAt(report.renderReports, 'create').markup
    expect(create).toContain('Cairo Travel Guide')
    expect(create).toContain('cairo-travel-guide')
    expect(create).toContain('aria-describedby')

    const edit = reportAt(report.renderReports, 'edit').markup
    expect(edit).toContain('Updated Nile Guide')
    expect(edit).toContain('updated-nile-guide')
    expect(edit).toContain('value="us"')
    expect(edit).toContain('Select an option')
    expect(edit).toContain('Section 1 heading is required')
    expect(edit).toContain('aria-invalid="true"')
  })
})
