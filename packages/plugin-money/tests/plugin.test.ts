import { field, schema } from '@holo-js/forms'
import { bindFormSchema, columnsFor, validateFormFields, type CustomColumn, type ExtensionTypeId } from '@holo-js/panels-core'
import { describe, expect, it } from 'vitest'
import { currencyField, moneyColumn, moneyPlugin } from '../src/index'

class Post {
  readonly amount = 0
  readonly title = ''
}

describe('money plugin public contract', () => {
  it('builds currency fields and money columns with stable extension IDs', async () => {
    const formSchema = schema({ amount: field.number().min(0) })
    const compiledField = currencyField(bindFormSchema(formSchema).bind('amount'), 'usd').compile()
    const columnBuilder = moneyColumn(columnsFor(Post), 'amount', 'EUR')
    const inferredColumn: CustomColumn<Post, 'amount', ExtensionTypeId<'column'>> = columnBuilder
    const column = columnBuilder.compile()

    expect(inferredColumn).toBe(columnBuilder)
    expect(compiledField.type).toBe('holo.money:field:currency')
    expect(compiledField.properties).toEqual({ currency: 'USD', minorUnits: 2 })
    expect(await validateFormFields([compiledField], { amount: 1200 })).toEqual({})
    expect(await validateFormFields([compiledField], { amount: -1 })).toHaveProperty('amount')
    expect(column.manifest.type).toBe('holo.money:column:money')
    expect(column.manifest.formatters).toContainEqual({ configuration: { currency: 'EUR', locale: null }, kind: 'custom' })
  })

  it('contributes complete renderer, translation, icon, asset, and default metadata', () => {
    const installation = moneyPlugin.install({ guard: 'web', id: 'admin' })
    const kinds = installation.contributions.map(contribution => contribution.kind)

    expect(kinds.filter(kind => kind === 'renderer')).toHaveLength(6)
    expect(kinds).toEqual(expect.arrayContaining(['extension', 'translation', 'icon', 'asset', 'default']))
    expect(installation.contributions).not.toContainEqual(expect.objectContaining({ source: expect.stringContaining('/') }))
  })

  it('rejects invalid currencies before compiling client metadata', () => {
    const formSchema = schema({ amount: field.number() })
    expect(() => currencyField(bindFormSchema(formSchema).bind('amount'), '../usd')).toThrow('ISO 4217')
  })
})
