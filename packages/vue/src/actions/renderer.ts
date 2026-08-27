import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  PanelsIcon,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '../internal-ui'
import { defineComponent, h, shallowRef, watch, type PropType, type VNode } from 'vue'
import type { ClientActionFrame, ClientActionState, JsonObject } from '@holo-js/panels-client'
import { actionFormField, actionFormSchema, actionManifestCollection } from '@holo-js/panels-client'
import { ActionsRenderHook } from '@holo-js/panels-core'
import type { ActionModalWidth, RenderSlotReference } from '@holo-js/panels-core'
import { createComponentRegistry } from '../registry'
import { VueSchemaRenderer } from '../schemas/renderer'
import { VueFieldRenderer } from '../fields/renderer'
import { usePanelsRenderHook } from '../render-hooks'
import type { VueActionCustomProps, VueActionRendererProps, VueActionSlotProps } from './types'

const emptyRegistry = createComponentRegistry()

function modalWidthClass(width: ActionModalWidth): string {
  if (width === 'small') return 'hp:w-full hp:sm:max-w-sm'
  if (width === 'large') return 'hp:w-full hp:sm:max-w-2xl'
  if (width === 'extra-large') return 'hp:w-full hp:sm:max-w-4xl'
  if (width === 'screen') return 'hp:h-[calc(100vh-2rem)] hp:w-[calc(100vw-2rem)] hp:max-w-none'
  return 'hp:w-full hp:sm:max-w-lg'
}

function modalSlotReference(value: JsonObject | RenderSlotReference | null): RenderSlotReference | null {
  if (!value || typeof value.component !== 'string') return null
  const properties = value.properties
  if (properties === undefined) return { component: value.component }
  if (!properties || Array.isArray(properties) || typeof properties !== 'object') return null
  return { component: value.component, properties }
}

export const VueActionRenderer = defineComponent({
  name: 'VueActionRenderer',
  props: {
    action: { type: Object as PropType<VueActionRendererProps['action']>, required: true },
    actions: Array as PropType<VueActionRendererProps['actions']>,
    input: Object as PropType<JsonObject>,
    groups: Array as PropType<VueActionRendererProps['groups']>,
    panelId: String,
    recordIds: Array as PropType<readonly (number | string)[]>,
    registry: Object as PropType<VueActionRendererProps['registry']>,
    store: { type: Object as PropType<VueActionRendererProps['store']>, required: true },
  },
  setup(props) {
    const renderHook = usePanelsRenderHook()
    const state = shallowRef<ClientActionState>(props.store.state)
    const openGroups = shallowRef<ReadonlySet<string>>(new Set())
    watch(() => props.store, (store, _previous, cleanup) => {
      state.value = store.state
      cleanup(store.subscribe(next => { state.value = next }))
    }, { immediate: true })

    async function submit(): Promise<void> {
      try {
        const store = props.store
        const result = await store.submit(props.recordIds)
        if (store.activeFrame?.result === result) store.close()
      } catch {
        return
      }
    }

    function activate(action: VueActionRendererProps['action']): void {
      props.store.mount(action, props.input)
      if (!action.confirmation && !action.modal) void submit()
    }

    function form(frame: ClientActionFrame): VNode {
      const schema = actionFormSchema(frame.manifest.modal?.schema ?? null, frame.manifest.id)
      return h('form', {
        class: 'hp-panel-form hp:grid hp:gap-6',
        novalidate: true,
        onSubmit: (event: Event) => {
          event.preventDefault()
          void submit()
        },
      }, [
        schema
          ? [renderHook(ActionsRenderHook.MODAL_SCHEMA_BEFORE), h(VueSchemaRenderer, {
              panelId: props.panelId ?? 'default',
              registry: props.registry ?? emptyRegistry,
              renderContent: ({ component }) => {
                const definition = actionFormField(component)
                return definition && props.store.activeForm ? h(VueFieldRenderer, { field: { definition, optionStore: props.store.optionStore(definition), panelId: props.panelId, registry: props.registry ?? emptyRegistry, store: props.store.activeForm } }) : null
              },
              schema,
            }), renderHook(ActionsRenderHook.MODAL_SCHEMA_AFTER)]
          : null,
        props.store.activeForm?.state.errors._root?.length ? h('ul', { 'data-form-errors': '', role: 'alert' }, props.store.activeForm.state.errors._root.map(message => h('li', message))) : null,
        h(Button, { class: 'hp-action-trigger', 'data-action-id': frame.manifest.id, 'data-color': frame.manifest.color ?? undefined, disabled: frame.phase === 'submitting', type: 'submit', variant: frame.manifest.color === 'danger' ? 'destructive' : 'outline' }, () => [frame.manifest.icon ? PanelsIcon(frame.manifest.icon) : null, h('span', frame.phase === 'submitting' ? 'Working…' : frame.manifest.modal?.submitActionLabel ?? 'Run action')]),
      ])
    }

    function trigger(action: VueActionRendererProps['action']): VNode | null {
      if (action.visible === false) return null
      return h(Button, {
        class: 'hp-action-trigger',
        'data-action-id': action.id,
        'data-action': action.id,
        'data-operation': action.kind,
        'data-color': action.color ?? undefined,
        disabled: action.disabled === true || state.value.frames.some(frame => frame.manifest.id === action.id),
        type: 'button',
        variant: action.color === 'danger' ? 'destructive' : 'outline',
        onClick: () => activate(action),
      }, () => [action.icon ? PanelsIcon(action.icon) : null, h('span', action.label)])
    }

    function modalSlot(frame: ClientActionFrame, placement: 'content' | 'footer'): VNode | null {
      const reference = frame.manifest.modal?.[placement]
      const slot = modalSlotReference(reference ?? null)
      if (!slot || !props.registry) return null
      const Renderer = props.registry.resolve(slot.component, props.panelId, `action modal ${placement}`)
      return h(Renderer, { ...(slot.properties ?? {}), frame } satisfies VueActionSlotProps)
    }

    return () => {
      const actions = actionManifestCollection(props.actions ?? [props.action])
      const nestedIds = new Set(actions.flatMap(action => action.modal?.nestedActions ?? []))
      const grouped = new Set(props.groups?.flatMap(group => group.actions) ?? [])
      return h('div', { class: 'hp-action', 'data-action-mount': props.action.mount }, [
      h('div', { class: 'hp-action-collection' }, [
        ...actions.filter(action => !grouped.has(action.id) && !nestedIds.has(action.id)).map(trigger),
        ...props.groups?.map(group => {
          const items = group.actions.flatMap(id => {
            const action = actions.find(candidate => candidate.id === id)
            return !action || action.visible === false ? [] : [action]
          })
          return h(DropdownMenu, {
          open: openGroups.value.has(group.id),
          'onUpdate:open': (open: boolean) => {
            const next = new Set(openGroups.value)
            if (open) next.add(group.id)
            else next.delete(group.id)
            openGroups.value = next
          },
        }, () => [
          h(DropdownMenuTrigger, { asChild: true }, () => h(Button, { 'aria-label': group.label ?? 'Actions', class: 'hp-action-group-trigger', 'data-action-group': group.id, variant: 'outline' }, () => [group.icon ? PanelsIcon(group.icon) : null, group.label ?? 'Actions'])),
          h(DropdownMenuContent, { 'data-holo-panel': '' }, () => items.map(item => h(DropdownMenuItem, { 'data-action': item.id, 'data-action-id': item.id, 'data-color': item.color ?? undefined, disabled: item.disabled || state.value.frames.some(frame => frame.manifest.id === item.id), variant: item.color === 'danger' ? 'destructive' : 'default', onSelect: () => activate(item) }, () => [item.icon ? PanelsIcon(item.icon) : null, item.label]))),
        ])
        }) ?? [],
      ]),
      ...state.value.frames.slice(-1).map((frame, index) => {
        if (!frame.manifest.modal && frame.phase === 'submitting') return null
        const dismiss = {
          onEscapeKeyDown: (event: Event) => { if (frame.manifest.modal?.closeByEscaping === false) event.preventDefault() },
          onPointerDownOutside: (event: Event) => { if (frame.manifest.modal?.closeByClickingAway === false) event.preventDefault() },
          onOpenAutoFocus: (event: Event) => { if (frame.manifest.modal?.autofocus === false) event.preventDefault() },
        }
        const customName = `action.${frame.manifest.id}`
        const Custom = props.registry?.has(customName, props.panelId)
          ? props.registry.resolve(customName, props.panelId, 'action modal')
          : null
        if (frame.phase === 'confirming') return h(AlertDialog, { key: `${frame.manifest.id}-${index}`, open: true }, () => h(AlertDialogContent, {
          'data-holo-panel': '',
          ...dismiss,
          onEscapeKeyDown: (event: Event) => { dismiss.onEscapeKeyDown(event); if (!event.defaultPrevented) props.store.close() },
          onPointerDownOutside: (event: Event) => { dismiss.onPointerDownOutside(event); if (!event.defaultPrevented) props.store.close() },
        }, () => [
          h(AlertDialogHeader, {}, () => [h(AlertDialogTitle, {}, () => frame.manifest.modal?.heading ?? frame.manifest.label), h(AlertDialogDescription, {}, () => frame.manifest.confirmation ?? 'Are you sure?')]),
          h(AlertDialogFooter, {}, () => [h(AlertDialogCancel, { onClick: () => props.store.close() }, () => frame.manifest.modal?.cancelActionLabel ?? 'Cancel'), h(AlertDialogAction, {
            variant: frame.manifest.color === 'danger' ? 'destructive' : 'default',
            onClick: (event: MouseEvent) => {
              event.preventDefault()
              props.store.confirm()
              if (!frame.manifest.modal) void submit()
            },
          }, () => [frame.manifest.icon ? PanelsIcon(frame.manifest.icon) : null, 'Confirm'])]),
        ]))
        const content = Custom
            ? [h(Custom, {
                frame,
                setInput: (input: JsonObject) => props.store.setInput(input),
                submit,
              } satisfies VueActionCustomProps)]
            : [form(frame)]
        const slideOver = frame.manifest.modal?.slideOver === true
        const Root = slideOver ? Sheet : Dialog
        const Content = slideOver ? SheetContent : DialogContent
        const Header = slideOver ? SheetHeader : DialogHeader
        const Title = slideOver ? SheetTitle : DialogTitle
        const Description = slideOver ? SheetDescription : DialogDescription
        const Footer = slideOver ? SheetFooter : DialogFooter
        const modalWidth = frame.manifest.modal?.width ?? 'medium'
        return h(Root, { key: `${frame.manifest.id}-${index}`, open: true, 'onUpdate:open': (open: boolean) => { if (!open) props.store.close() } }, () => h(Content, {
          ...dismiss,
          class: modalWidthClass(modalWidth),
          'data-holo-panel': '',
          'data-modal-width': modalWidth,
          'data-panels-component': slideOver ? 'slide-over' : 'modal',
        }, () => [
            h(Header, {}, () => [h(Title, {}, () => frame.manifest.modal?.heading ?? frame.manifest.label), frame.manifest.modal?.description ? h(Description, {}, () => frame.manifest.modal?.description) : null]),
            renderHook(ActionsRenderHook.MODAL_CUSTOM_CONTENT_BEFORE),
            modalSlot(frame, 'content'),
            renderHook(ActionsRenderHook.MODAL_CUSTOM_CONTENT_AFTER),
            ...content,
            ...frame.manifest.modal?.nestedActions.flatMap(id => {
              const action = actions.find(candidate => candidate.id === id)
              return action ? [trigger(action)] : []
            }) ?? [],
            renderHook(ActionsRenderHook.MODAL_CUSTOM_CONTENT_FOOTER_BEFORE),
            modalSlot(frame, 'footer'),
            renderHook(ActionsRenderHook.MODAL_CUSTOM_CONTENT_FOOTER_AFTER),
            h(Footer, {}, () => h(Button, { type: 'button', variant: 'outline', onClick: () => props.store.close() }, () => frame.manifest.modal?.cancelActionLabel ?? 'Close')),
          ]))
      }),
    ])
    }
  },
})
