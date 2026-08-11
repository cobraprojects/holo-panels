import { describe, expect, it } from 'vitest'
import type { SvelteDefinedFieldRendererProps, SvelteRendererDefinition } from '../src/extensions'
import type { SvelteCustomFieldProps } from '../src/fields/contracts'
import type { SvelteCustomColumnProps, SvelteTableColumnPath } from '../src/tables/types'

interface Invoice {
  readonly amount: number
  readonly customer: {
    readonly name: string
  }
  readonly id: string
}

type Equal<TLeft, TRight> = (<TValue>() => TValue extends TLeft ? 1 : 2) extends (<TValue>() => TValue extends TRight ? 1 : 2) ? true : false
type Expect<TValue extends true> = TValue

type Assertions = readonly [
  Expect<Equal<SvelteCustomFieldProps<Invoice, 'amount'>['value'], number>>,
  Expect<Equal<SvelteCustomColumnProps<Invoice, 'customer.name'>['value'], string>>,
  Expect<Equal<'missing' extends SvelteTableColumnPath<Invoice> ? true : false, false>>,
  Expect<Equal<SvelteDefinedFieldRendererProps<SvelteRendererDefinition<number>>['value'], number>>,
]

describe('Svelte renderer inference', () => {
  it('preserves field paths and values', () => {
    const assertions: Assertions = [true, true, true, true]
    expect(assertions).toEqual([true, true, true, true])
  })
})
