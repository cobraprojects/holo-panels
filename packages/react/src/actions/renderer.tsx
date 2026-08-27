import { createElement, useSyncExternalStore, type FormEvent, type ReactNode } from 'react'
import type { ClientActionFrame, JsonObject } from '@holo-js/panels-client'
import { ActionsRenderHook, type ActionModalWidth, type RenderSlotReference, type SchemaManifest } from '@holo-js/panels-core'
import { PanelsIcon } from '../internal-ui'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '../ui/sheet'
import { createComponentRegistry } from '../registry'
import { ReactSchemaRenderer } from '../schema'
import { ReactPanelsRenderHook } from '../render-hooks'
import type { ReactActionCustomProps, ReactActionRendererProps, ReactActionSlotProps } from './types'

const emptyRegistry = createComponentRegistry()

function modalWidthClass(width: ActionModalWidth): string {
  if (width === 'small') return 'hp:w-full hp:sm:max-w-sm'
  if (width === 'large') return 'hp:w-full hp:sm:max-w-2xl'
  if (width === 'extra-large') return 'hp:w-full hp:sm:max-w-4xl'
  if (width === 'screen') return 'hp:w-[calc(100vw-2rem)] hp:max-w-none'
  return 'hp:w-full hp:sm:max-w-lg'
}

function modalSlotReference(value: JsonObject | RenderSlotReference | null): RenderSlotReference | null {
  if (!value || typeof value.component !== 'string') return null
  const properties = value.properties
  if (properties === undefined) return { component: value.component }
  if (!properties || Array.isArray(properties) || typeof properties !== 'object') return null
  return { component: value.component, properties }
}

function isModalSchema(value: JsonObject): value is JsonObject & SchemaManifest<JsonObject> {
  return value.kind === 'schema' && typeof value.id === 'string' && Array.isArray(value.components)
}

function modalSchema(value: JsonObject | null): SchemaManifest<JsonObject> | null {
  return value && isModalSchema(value) ? value : null
}

function ActionTrigger<TResult>({ action, props }: { readonly action: ReactActionRendererProps<TResult>['manifest'], readonly props: ReactActionRendererProps<TResult> }): ReactNode {
  if (action.visible === false) return null
  return <Button
    className="hp-action-trigger"
    data-action-id={action.id}
    data-color={action.color ?? undefined}
    disabled={action.disabled === true || props.store.state.frames.some(frame => frame.manifest.id === action.id)}
    onClick={() => props.store.mount(action)}
    type="button"
    variant={action.color === 'danger' ? 'destructive' : 'outline'}
  >{action.icon ? <PanelsIcon name={action.icon} /> : null}<span>{action.label}</span></Button>
}

function ActionTriggers<TResult>(props: ReactActionRendererProps<TResult>): ReactNode {
  const actions = props.actions ?? [props.manifest]
  const grouped = new Set(props.groups?.flatMap(group => group.actions) ?? [])
  return <div className="hp-action-collection">
    {actions.filter(action => !grouped.has(action.id)).map(action => <ActionTrigger action={action} key={action.id} props={props} />)}
    {props.groups?.map(group => <DropdownMenu key={group.id}>
      <DropdownMenuTrigger asChild><Button variant="outline">{group.icon ? <PanelsIcon name={group.icon} /> : null}{group.label ?? 'Actions'}</Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" data-action-color={group.color ?? undefined}>
        {group.actions.flatMap(id => {
          const action = actions.find(candidate => candidate.id === id)
          if (!action || action.visible === false) return []
          return [<DropdownMenuItem disabled={action.disabled} key={id} onSelect={() => props.store.mount(action)} variant={action.color === 'danger' ? 'destructive' : 'default'}>{action.icon ? <PanelsIcon name={action.icon} /> : null}{action.label}</DropdownMenuItem>]
        })}
      </DropdownMenuContent>
    </DropdownMenu>)}
  </div>
}

function ModalSlot<TResult>({ frame, placement, props }: { readonly frame: ClientActionFrame<TResult>, readonly placement: 'content' | 'footer', readonly props: ReactActionRendererProps<TResult> }): ReactNode {
  const reference = frame.manifest.modal?.[placement]
  const slot = modalSlotReference(reference ?? null)
  if (!slot) return null
  const Renderer = props.registry?.resolve<ReactActionSlotProps<TResult>>(slot.component, props.panelId, `action modal ${placement}`)
  return Renderer ? createElement(Renderer, { ...(slot.properties ?? {}), frame }) : null
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
      const schema = modalSchema(frame.manifest.modal?.schema ?? null)
      const Custom = props.registry?.has(customName, props.panelId)
        ? props.registry.resolve<ReactActionCustomProps<TResult>>(customName, props.panelId, 'action modal')
        : null
      if (frame.phase === 'confirming') {
        return <AlertDialog key={frame.manifest.id} onOpenChange={open => { if (!open) props.store.close() }} open>
          <AlertDialogContent data-holo-panel="">
            <AlertDialogHeader>
              <AlertDialogTitle id={titleId}>{frame.manifest.modal?.heading ?? frame.manifest.label}</AlertDialogTitle>
              <AlertDialogDescription>{frame.manifest.confirmation}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => props.store.close()}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={event => { event.preventDefault(); props.store.confirm() }} variant={frame.manifest.color === 'danger' ? 'destructive' : 'default'}>{frame.manifest.icon ? <PanelsIcon name={frame.manifest.icon} /> : null}Confirm</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      }
      const content = <>
        <ReactPanelsRenderHook hook={ActionsRenderHook.MODAL_CUSTOM_CONTENT_BEFORE} />
        <ModalSlot frame={frame} placement="content" props={props} />
        <ReactPanelsRenderHook hook={ActionsRenderHook.MODAL_CUSTOM_CONTENT_AFTER} />
        {Custom
          ? createElement(Custom, { frame, setInput: input => props.store.setInput(input), submit })
          : <form className="hp:grid hp:gap-4" onSubmit={(event: FormEvent) => {
              event.preventDefault()
              void submit()
            }}>
            {schema
              ? <><ReactPanelsRenderHook hook={ActionsRenderHook.MODAL_SCHEMA_BEFORE} /><ReactSchemaRenderer panelId={props.panelId ?? 'default'} registry={props.registry ?? emptyRegistry} schema={schema} /><ReactPanelsRenderHook hook={ActionsRenderHook.MODAL_SCHEMA_AFTER} /></>
              : null}
            <DialogFooter>
              <Button className="hp-action-trigger" data-action-id={frame.manifest.id} data-color={frame.manifest.color ?? undefined} disabled={frame.phase === 'submitting'} type="submit" variant={frame.manifest.color === 'danger' ? 'destructive' : 'default'}>{frame.manifest.icon ? <PanelsIcon name={frame.manifest.icon} /> : null}<span>{frame.phase === 'submitting' ? 'Working…' : 'Run action'}</span></Button>
            </DialogFooter>
          </form>}
        {frame.manifest.modal?.nestedActions.map(id => {
          const nested = props.actions?.find(action => action.id === id)
          return nested ? <ActionTrigger action={nested} key={id} props={props} /> : null
        })}
        <ReactPanelsRenderHook hook={ActionsRenderHook.MODAL_CUSTOM_CONTENT_FOOTER_BEFORE} />
        <ModalSlot frame={frame} placement="footer" props={props} />
        <ReactPanelsRenderHook hook={ActionsRenderHook.MODAL_CUSTOM_CONTENT_FOOTER_AFTER} />
      </>
      const heading = frame.manifest.modal?.heading ?? frame.manifest.label
      const description = frame.manifest.modal?.description
      const modalWidth = frame.manifest.modal?.width ?? 'medium'
      return frame.manifest.modal?.slideOver
        ? <Sheet key={frame.manifest.id} onOpenChange={open => { if (!open) props.store.close() }} open>
          <SheetContent className={modalWidthClass(modalWidth)} data-holo-panel="" data-modal-width={modalWidth} data-panels-component="slide-over" side="right">
            <SheetHeader><SheetTitle id={titleId}>{heading}</SheetTitle>{description ? <SheetDescription>{description}</SheetDescription> : null}</SheetHeader>
            <div className="hp:flex-1 hp:overflow-y-auto hp:px-4">{content}</div>
            <SheetFooter><Button onClick={() => props.store.close()} variant="outline">Close</Button></SheetFooter>
          </SheetContent>
        </Sheet>
        : <Dialog key={frame.manifest.id} onOpenChange={open => { if (!open) props.store.close() }} open>
          <DialogContent className={modalWidthClass(modalWidth)} data-holo-panel="" data-modal-width={modalWidth} data-panels-component="modal">
            <DialogHeader><DialogTitle id={titleId}>{heading}</DialogTitle>{description ? <DialogDescription>{description}</DialogDescription> : null}</DialogHeader>
            {content}
            <DialogFooter><Button onClick={() => props.store.close()} variant="outline">Close</Button></DialogFooter>
          </DialogContent>
        </Dialog>
    })}
  </div>
}
