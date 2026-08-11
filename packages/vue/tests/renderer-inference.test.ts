import { describe, expect, it } from 'vitest'
import { defineVueFieldRenderer, type VueDefinedFieldRendererProps, type VueRendererDefinition } from '../src/extensions'
import type { VueFieldControlProps } from '../src/fields/types'
import type { VueCustomColumnProps, VueTableColumnPath } from '../src/tables/types'

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
  Expect<Equal<VueFieldControlProps<Invoice, 'amount'>['context']['value'], number>>,
  Expect<Equal<VueCustomColumnProps<Invoice, 'customer.name'>['value'], string>>,
  Expect<Equal<'missing' extends VueTableColumnPath<Invoice> ? true : false, false>>,
  Expect<Equal<VueDefinedFieldRendererProps<VueRendererDefinition<number>>['context']['value'], number>>,
]

describe('Vue renderer inference', () => {
  it('preserves field paths and values', () => {
    const Renderer = defineVueFieldRenderer({ valueType: 1 }, props => props.context.value.toFixed(2))
    const assertions: Assertions = [true, true, true, true]
    expect(Renderer).toBeTypeOf('function')
    expect(assertions).toEqual([true, true, true, true])
  })
})
