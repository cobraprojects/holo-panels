import { describe, expect, it } from 'vitest'
import { defineReactFieldRenderer, type ReactDefinedFieldRendererProps, type ReactRendererDefinition } from '../src/extensions'
import type { ReactFieldControlProps } from '../src/fields/types'
import type { ReactCustomColumnProps, ReactTableColumnPath } from '../src/tables/types'

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
  Expect<Equal<ReactFieldControlProps<Invoice, 'amount'>['context']['value'], number>>,
  Expect<Equal<ReactCustomColumnProps<Invoice, 'customer.name'>['value'], string>>,
  Expect<Equal<'missing' extends ReactTableColumnPath<Invoice> ? true : false, false>>,
  Expect<Equal<ReactDefinedFieldRendererProps<ReactRendererDefinition<number>>['context']['value'], number>>,
]

describe('React renderer inference', () => {
  it('preserves field paths and values', () => {
    const Renderer = defineReactFieldRenderer({ valueType: 1 }, props => props.context.value.toFixed(2))
    const assertions: Assertions = [true, true, true, true]
    expect(Renderer).toBeTypeOf('function')
    expect(assertions).toEqual([true, true, true, true])
  })
})
