import { TableStateStore, type ExtensionTypeId } from '@holo-js/panels-client'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createComponentRegistry, registerReactExtensionRenderer } from '../src/registry'
import { ReactTableRenderer } from '../src/tables/renderer'
import type { ReactCustomColumnProps, ReactTableColumn, ReactTableRendererProps } from '../src/tables/types'

interface Invoice {
  readonly amount: number
  readonly id: number
}

const moneyType = 'holo.money:column:money' as ExtensionTypeId<'column'>

function MoneyColumn(props: ReactCustomColumnProps<Invoice>): ReturnType<typeof createElement> {
  return createElement('span', { className: 'money' }, `${String(props.currency)} ${String(props.value)}`)
}

describe('P16 React custom column renderer', () => {
  it('resolves custom column types through the shared extension registry with configuration', () => {
    const registry = createComponentRegistry()
    registerReactExtensionRenderer(registry, 'column', moneyType, MoneyColumn)
    const columns: readonly ReactTableColumn<Invoice>[] = [{
      manifest: {
        alignment: 'start',
        copyable: false,
        formatters: [{ configuration: { currency: 'EUR' }, kind: 'custom' }],
        hidden: false,
        inlineEditor: null,
        label: 'Amount',
        path: 'amount',
        sortable: false,
        toggleable: true,
        type: moneyType,
        width: null,
        wrap: true,
      },
    }]
    const store = new TableStateStore<Invoice, number>({
      panelId: 'admin',
      records: [{ amount: 120, id: 1 }],
      tableId: 'invoices',
      total: 1,
    })
    const table: ReactTableRendererProps<Invoice, number> = {
      caption: 'Invoices',
      columns,
      getRecordId: record => record.id,
      panelId: 'admin',
      registry,
      store,
    }

    const Fixture = (): ReturnType<typeof createElement> => createElement('div', null, ReactTableRenderer(table))
    expect(renderToString(createElement(Fixture))).toContain('<span class="money">EUR 120</span>')
  })

  it('fails closed when a custom column registry is absent', () => {
    const store = new TableStateStore<Invoice, number>({ panelId: 'admin', records: [{ amount: 1, id: 1 }], tableId: 'invoices', total: 1 })
    const column: ReactTableColumn<Invoice> = {
      manifest: { alignment: 'start', copyable: false, hidden: false, inlineEditor: null, label: null, path: 'amount', sortable: false, toggleable: true, type: moneyType, width: null, wrap: true },
    }

    const table: ReactTableRendererProps<Invoice, number> = { caption: 'Invoices', columns: [column], getRecordId: record => record.id, store }
    const Fixture = (): ReturnType<typeof createElement> => createElement('div', null, ReactTableRenderer(table))
    expect(() => renderToString(createElement(Fixture))).toThrow('registry is required')
  })
})
