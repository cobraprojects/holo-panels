import { useSyncExternalStore, type ReactNode } from 'react'
import { actionFormField, type DashboardFilterStore } from '@holo-js/panels-client'
import { Button } from '../internal-ui'
import { ReactSchemaRenderer } from '../schema/renderer'
import { ReactFieldRenderer } from '../fields/renderer'
import type { ComponentRegistry } from '../registry'

export function ReactDashboardFilters({ store, panelId, registry }: { readonly store: DashboardFilterStore, readonly panelId: string, readonly registry: ComponentRegistry }): ReactNode {
  const state = useSyncExternalStore(listener => store.form.subscribe(listener), () => store.form.state, () => store.form.state)
  return <form aria-label="Dashboard filters" className="hp-dashboard-filters hp:grid hp:gap-4" noValidate onSubmit={event => { event.preventDefault(); void store.submit() }}>
    <ReactSchemaRenderer panelId={panelId} registry={registry} schema={store.schema} renderContent={({ component }) => {
      const definition = actionFormField(component)
      return definition ? <ReactFieldRenderer definition={definition} optionStore={store.optionStore(definition)} panelId={panelId} registry={registry} store={store.form} /> : null
    }} />
    <div className="hp:flex hp:gap-2"><Button disabled={state.submitting} type="submit">Apply filters</Button><Button disabled={state.submitting} onClick={() => void store.submit(true)} type="button" variant="outline">Reset filters</Button></div>
    {state.errors._root?.map(message => <p key={message} role="alert">{message}</p>)}
  </form>
}
