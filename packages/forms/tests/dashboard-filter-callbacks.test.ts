import { describe, expect, it } from 'vitest'
import { defineDashboard } from '@holo-js/panels-core'
import { dashboardPage, resolvePageData } from '@holo-js/panels-core/server'
import { Schema } from '@holo-js/panels-schemas'
import { TextInput } from '../src'

describe('shared dashboard filter fields', () => {
  it('resolves compiled field callbacks on the server without exposing their source', async () => {
    const dashboard = defineDashboard('metrics').filtersForm(new Schema().components([
      TextInput.make('period').default(() => 'month').label(() => 'Reporting period').disabled(() => true),
    ]).compile()).compile()
    const result = await resolvePageData(dashboardPage(dashboard), { actor: {}, tenant: null, services: {}, locale: 'en', panelId: 'admin', parameters: {}, signal: new AbortController().signal })
    expect(result.data.filters).toEqual({ period: 'month' })
    expect(result.manifest.body?.properties.dashboard).toMatchObject({ filters: { fields: [{ disabled: true, label: 'Reporting period' }] } })
    expect(JSON.stringify(result)).not.toContain('server')
  })
})
