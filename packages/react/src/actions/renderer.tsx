import { usePanelDirection, usePanelLocale, usePanelTranslator } from '../localization'
import { createElement, useMemo, useSyncExternalStore, type FormEvent, type ReactNode } from 'react'
import type { ClientActionFrame, JsonObject } from '@holo-js/panels-client'
import { actionFormField, actionFormSchema, actionManifestCollection, readOnlyPresentationStores } from '@holo-js/panels-client'
import { ActionsRenderHook, type ActionModalWidth, type RenderSlotReference } from '@holo-js/panels-core'
import { PanelsIcon } from '../internal-ui'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '../ui/sheet'
import { createComponentRegistry } from '../registry'
import { ReactSchemaRenderer } from '../schema'
import { ReactFieldRenderer } from '../fields/renderer'
import { ReactEntryRenderer } from '../entries/renderer'
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

async function submitAction<TResult>(props: ReactActionRendererProps<TResult>): Promise<void> {
  try {
    const result = await props.store.submit(props.recordIds)
    if (props.store.activeFrame?.result === result) props.store.close()
  } catch {
    return
  }
}

function activateAction<TResult>(props: ReactActionRendererProps<TResult>, action: ReactActionRendererProps<TResult>['manifest']): void {
  props.store.mount(action, props.input)
  if (!action.confirmation && !action.modal) void submitAction(props)
}

function ActionTrigger<TResult>({ action, props }: { readonly action: ReactActionRendererProps<TResult>['manifest'], readonly props: ReactActionRendererProps<TResult> }): ReactNode {
  if (action.visible === false) return null
  return <Button
    className="hp-action-trigger"
    data-action-id={action.id}
    data-action={action.id}
    data-operation={action.kind}
    data-color={action.color ?? undefined}
    disabled={action.disabled === true || props.store.state.frames.some(frame => frame.manifest.id === action.id)}
    onClick={() => activateAction(props, action)}
    title={action.tooltip ?? undefined}
    type="button"
    variant={action.color === 'danger' ? 'destructive' : 'outline'}
  >{action.icon ? <PanelsIcon name={action.icon} /> : null}<span>{action.label}</span></Button>
}

function ActionTriggers<TResult>(props: ReactActionRendererProps<TResult>): ReactNode {
  const actions = actionManifestCollection(props.actions ?? [props.manifest])
  const translate = usePanelTranslator(props.locale)
  const nestedIds = new Set(actions.flatMap(action => action.modal?.nestedActions ?? []))
  const grouped = new Set(props.groups?.flatMap(group => group.actions) ?? [])
  return <div className="hp-action-collection">
    {actions.filter(action => !grouped.has(action.id) && !nestedIds.has(action.id)).map(action => <ActionTrigger action={action} key={action.id} props={props} />)}
    {props.groups?.map(group => <DropdownMenu key={group.id}>
      <DropdownMenuTrigger asChild><Button aria-label={group.label ?? translate('actions.group')} className="hp-action-group-trigger" data-action-group={group.id} variant="outline">{group.icon ? <PanelsIcon name={group.icon} /> : null}{group.label ?? translate('actions.group')}</Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" data-action-color={group.color ?? undefined}>
        {group.actions.flatMap(id => {
          const action = actions.find(candidate => candidate.id === id)
          if (!action || action.visible === false) return []
          return [<DropdownMenuItem data-action={id} data-action-id={id} data-color={action.color ?? undefined} disabled={action.disabled || props.store.state.frames.some(frame => frame.manifest.id === id)} key={id} onSelect={() => activateAction(props, action)} variant={action.color === 'danger' ? 'destructive' : 'default'}>{action.icon ? <PanelsIcon name={action.icon} /> : null}{action.label}</DropdownMenuItem>]
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

function ReadOnlyPresentation<TResult>({ frame, props }: { readonly frame: ClientActionFrame<TResult>, readonly props: ReactActionRendererProps<TResult> }): ReactNode {
  const presentation = frame.manifest.modal?.readOnlyPresentation
  const inheritedLocale = usePanelLocale()
  const locale = props.locale ?? inheritedLocale
  const stores = useMemo(() => readOnlyPresentationStores(presentation, locale), [presentation, locale])
  return <div className="hp:grid hp:gap-4" data-read-only-presentation="infolist">{stores.map(store => <ReactEntryRenderer key={store.snapshot.id} panelId={props.panelId} registry={props.registry} store={store} />)}</div>
}

export function ReactActionRenderer<TResult = unknown>(props: ReactActionRendererProps<TResult>): ReactNode {
  const translate = usePanelTranslator(props.locale)
  const inheritedDirection = usePanelDirection()
  const inheritedLocale = usePanelLocale()
  const state = useSyncExternalStore(
    listener => props.store.subscribe(listener),
    () => props.store.state,
    () => props.store.state,
  )
  const submit = (): Promise<void> => {
    props.store.activeForm?.setLocale(props.locale ?? inheritedLocale)
    return submitAction(props)
  }
  return <div className="hp-action" data-action-mount={props.manifest.mount}>
    {props.showTriggers === false ? null : <ActionTriggers {...props} />}
    {state.frames.slice(-1).map((frame, index) => {
      if (!frame.manifest.modal && frame.phase === 'submitting') return null
      const dismiss = {
        onEscapeKeyDown: (event: KeyboardEvent) => { if (frame.manifest.modal?.closeByEscaping === false) event.preventDefault() },
        onPointerDownOutside: (event: Event) => { if (frame.manifest.modal?.closeByClickingAway === false) event.preventDefault() },
        onOpenAutoFocus: (event: Event) => { if (frame.manifest.modal?.autofocus === false) event.preventDefault() },
      }
      const titleId = `hp-action-${frame.manifest.id.replace(/[^a-z0-9_-]/giu, '-')}-title-${index}`
      const customName = `action.${frame.manifest.id}`
      const schema = actionFormSchema(frame.manifest.modal?.schema ?? null, frame.manifest.id)
      const Custom = props.registry?.has(customName, props.panelId)
        ? props.registry.resolve<ReactActionCustomProps<TResult>>(customName, props.panelId, 'action modal')
        : null
      if (frame.phase === 'confirming') {
        return <AlertDialog key={frame.manifest.id} onOpenChange={open => { if (!open) props.store.close() }} open>
          <AlertDialogContent {...dismiss} data-holo-panel="">
            <AlertDialogHeader>
              <AlertDialogTitle id={titleId}>{frame.manifest.modal?.heading ?? frame.manifest.label}</AlertDialogTitle>
              <AlertDialogDescription>{frame.manifest.confirmation}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{frame.manifest.modal?.cancelActionLabel ?? translate('actions.cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={event => { event.preventDefault(); props.store.confirm(); if (!frame.manifest.modal) void submit() }} variant={frame.manifest.color === 'danger' ? 'destructive' : 'default'}>{frame.manifest.icon ? <PanelsIcon name={frame.manifest.icon} /> : null}{translate('actions.confirm')}</AlertDialogAction>
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
          : frame.manifest.modal?.readOnlyPresentation
            ? <ReadOnlyPresentation frame={frame} props={props} />
          : <form className="hp-panel-form hp:grid hp:gap-6" noValidate onSubmit={(event: FormEvent) => {
              event.preventDefault()
              void submit()
            }}>
            {schema
              ? <><ReactPanelsRenderHook hook={ActionsRenderHook.MODAL_SCHEMA_BEFORE} /><ReactSchemaRenderer panelId={props.panelId ?? 'default'} registry={props.registry ?? emptyRegistry} renderContent={({ component }) => {
                  const definition = actionFormField(component)
                  return definition && props.store.activeForm ? <ReactFieldRenderer definition={definition} optionStore={props.store.optionStore(definition)} panelId={props.panelId} registry={props.registry ?? emptyRegistry} store={props.store.activeForm} /> : null
                }} schema={schema} /><ReactPanelsRenderHook hook={ActionsRenderHook.MODAL_SCHEMA_AFTER} /></>
              : null}
            {frame.manifest.kind === 'view' ? null : <DialogFooter>
              <Button className="hp-action-trigger" data-action-id={frame.manifest.id} data-color={frame.manifest.color ?? undefined} disabled={frame.phase === 'submitting'} type="submit" variant={frame.manifest.color === 'danger' ? 'destructive' : 'default'}>{frame.manifest.icon ? <PanelsIcon name={frame.manifest.icon} /> : null}<span>{frame.phase === 'submitting' ? translate('actions.working') : frame.manifest.modal?.submitActionLabel ?? translate('actions.run')}</span></Button>
            </DialogFooter>}
            {props.store.activeForm?.state.errors._root?.length ? <ul data-form-errors="" role="alert">{props.store.activeForm.state.errors._root.map((message, index) => <li key={index}>{message}</li>)}</ul> : null}
          </form>}
        {frame.manifest.modal?.nestedActions.map(id => {
          const nested = actionManifestCollection(props.actions ?? [props.manifest]).find(action => action.id === id)
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
          <SheetContent {...dismiss} className={modalWidthClass(modalWidth)} closeLabel={translate('actions.close')} data-holo-panel="" data-modal-width={modalWidth} data-panels-component="slide-over" side={(props.direction ?? inheritedDirection) === 'rtl' ? 'left' : 'right'}>
            <SheetHeader><SheetTitle id={titleId}>{heading}</SheetTitle>{description ? <SheetDescription>{description}</SheetDescription> : null}</SheetHeader>
            <div className="hp:flex-1 hp:overflow-y-auto hp:px-4">{content}</div>
            <SheetFooter><Button onClick={() => props.store.close()} variant="outline">{frame.manifest.modal?.cancelActionLabel ?? translate('actions.close')}</Button></SheetFooter>
          </SheetContent>
        </Sheet>
        : <Dialog key={frame.manifest.id} onOpenChange={open => { if (!open) props.store.close() }} open>
          <DialogContent {...dismiss} className={modalWidthClass(modalWidth)} closeLabel={translate('actions.close')} data-holo-panel="" data-modal-width={modalWidth} data-panels-component="modal">
            <DialogHeader><DialogTitle id={titleId}>{heading}</DialogTitle>{description ? <DialogDescription>{description}</DialogDescription> : null}</DialogHeader>
            {content}
            <DialogFooter><Button onClick={() => props.store.close()} variant="outline">{frame.manifest.modal?.cancelActionLabel ?? translate('actions.close')}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
    })}
  </div>
}
