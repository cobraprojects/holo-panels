import { createElement, useSyncExternalStore, type FormEvent, type ReactNode } from 'react'
import type { ClientActionFrame } from '@holo-js/panels-client'
import { PanelsDropdown, PanelsModal, PanelsSlideOver } from '../primitives'
import { createComponentRegistry } from '../registry'
import { ReactSchemaRenderer } from '../schema'
import type { ReactActionCustomProps, ReactActionRendererProps, ReactActionSlotProps } from './types'

const emptyRegistry = createComponentRegistry()

function ActionTrigger<TResult>({ action, props }: { readonly action: ReactActionRendererProps<TResult>['manifest'], readonly props: ReactActionRendererProps<TResult> }): ReactNode {
  return action.visible === false ? null : <button
    data-action-id={action.id}
    disabled={action.disabled === true || props.store.state.frames.some(frame => frame.manifest.id === action.id)}
    onClick={() => props.store.mount(action)}
    type="button"
  >{action.label}</button>
}

function ActionTriggers<TResult>(props: ReactActionRendererProps<TResult>): ReactNode {
  const actions = props.actions ?? [props.manifest]
  const grouped = new Set(props.groups?.flatMap(group => group.actions) ?? [])
  return <div className="hp-action-collection">
    {actions.filter(action => !grouped.has(action.id)).map(action => <ActionTrigger action={action} key={action.id} props={props} />)}
    {props.groups?.map(group => <span data-action-color={group.color ?? undefined} data-action-icon={group.icon ?? undefined} key={group.id}><PanelsDropdown
      items={group.actions.flatMap(id => {
        const action = actions.find(candidate => candidate.id === id)
        return !action || action.visible === false ? [] : [{ disabled: action.disabled, id, label: action.label, onSelect: () => props.store.mount(action) }]
      })}
      label={group.label ?? 'Actions'}
    /></span>)}
  </div>
}

function ModalSlot<TResult>({ frame, placement, props }: { readonly frame: ClientActionFrame<TResult>, readonly placement: 'content' | 'footer', readonly props: ReactActionRendererProps<TResult> }): ReactNode {
  const reference = frame.manifest.modal?.[placement]
  if (!reference) return null
  const Renderer = props.registry?.resolve<ReactActionSlotProps<TResult>>(reference.component, props.panelId, `action modal ${placement}`)
  return Renderer ? createElement(Renderer, { ...reference.properties, frame }) : null
}

export function ReactActionRenderer<TResult = unknown>(props: ReactActionRendererProps<TResult>): ReactNode {
  const state = useSyncExternalStore(
    listener => props.store.subscribe(listener),
    () => props.store.state,
    () => props.store.state,
  )
  const submit = async (): Promise<void> => {
    try {
      await props.store.submit(props.recordIds)
    } catch {
      return
    }
  }
  return <div className="hp-action" data-action-mount={props.manifest.mount}>
    <ActionTriggers {...props} />
    {state.frames.slice(-1).map((frame, index) => {
      const titleId = `hp-action-${frame.manifest.id.replace(/[^a-z0-9_-]/giu, '-')}-title-${index}`
      const customName = `action.${frame.manifest.id}`
      const Custom = props.registry?.has(customName, props.panelId)
        ? props.registry.resolve<ReactActionCustomProps<TResult>>(customName, props.panelId, 'action modal')
        : null
      const submitFrame = async (): Promise<void> => submit()
      const Surface = frame.manifest.modal?.slideOver ? PanelsSlideOver : PanelsModal
      return <Surface data-modal-width={frame.manifest.modal?.width ?? 'medium'} key={frame.manifest.id} labelledBy={titleId} onClose={() => props.store.close()} open>
        <h2 id={titleId}>{frame.manifest.modal?.heading ?? frame.manifest.label}</h2>
        {frame.manifest.modal?.description ? <p>{frame.manifest.modal.description}</p> : null}
        <ModalSlot frame={frame} placement="content" props={props} />
        {frame.phase === 'confirming'
          ? <><p>{frame.manifest.confirmation}</p><button onClick={() => props.store.confirm()} type="button">Confirm</button></>
          : Custom
            ? createElement(Custom, { frame, setInput: input => props.store.setInput(input), submit: submitFrame })
            : <form onSubmit={(event: FormEvent) => {
                event.preventDefault()
                void submit()
              }}>
              {frame.manifest.modal?.schema
                ? <ReactSchemaRenderer
                    panelId={props.panelId ?? 'default'}
                    registry={props.registry ?? emptyRegistry}
                    schema={frame.manifest.modal.schema}
                  />
                : null}
              <button disabled={frame.phase === 'submitting'} type="submit">{frame.phase === 'submitting' ? 'Working…' : 'Run action'}</button>
            </form>}
        {frame.manifest.modal?.nestedActions.map(id => {
          const nested = props.actions?.find(action => action.id === id)
          return nested ? <ActionTrigger action={nested} key={id} props={props} /> : null
        })}
        {frame.error ? <div role="alert">{frame.error}</div> : null}
        {frame.phase === 'succeeded' ? <div aria-live="polite" role="status">Action completed</div> : null}
        <ModalSlot frame={frame} placement="footer" props={props} />
        <button onClick={() => props.store.close()} type="button">Close</button>
      </Surface>
    })}
  </div>
}
