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
import { defineComponent, h, onScopeDispose, shallowRef, type PropType, type VNode } from 'vue'
import { publishPanelError, type ClientActionFrame, type ClientActionState, type JsonObject } from '@holo-js/panels-client'
import { ActionsRenderHook } from '@holo-js/panels-core'
import type { ActionModalWidth } from '@holo-js/panels-core'
import { createComponentRegistry } from '../registry'
import { VueSchemaRenderer } from '../schemas/renderer'
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

export const VueActionRenderer = defineComponent({
  name: 'VueActionRenderer',
  props: {
    action: { type: Object as PropType<VueActionRendererProps['action']>, required: true },
    actions: Array as PropType<VueActionRendererProps['actions']>,
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
    let lastError: string | null = null
    const unsubscribe = props.store.subscribe(next => {
      state.value = next
      const error = next.frames.at(-1)?.error ?? null
      if (error && error !== lastError) publishPanelError(props.panelId ?? 'default', 'Action failed')
      lastError = error
    })
    onScopeDispose(unsubscribe)

    async function submit(): Promise<void> {
      try {
        await props.store.submit(props.recordIds)
      } catch {
        return
      }
    }

    function form(frame: ClientActionFrame): VNode {
      return h('form', {
        onSubmit: (event: Event) => {
          event.preventDefault()
          void submit()
        },
      }, [
        frame.manifest.modal?.schema
          ? [renderHook(ActionsRenderHook.MODAL_SCHEMA_BEFORE), h(VueSchemaRenderer, {
              panelId: props.panelId ?? 'default',
              registry: props.registry ?? emptyRegistry,
              schema: frame.manifest.modal.schema,
            }), renderHook(ActionsRenderHook.MODAL_SCHEMA_AFTER)]
          : null,
        h(Button, { class: 'hp-action-trigger', 'data-action-id': frame.manifest.id, 'data-color': frame.manifest.color ?? undefined, disabled: frame.phase === 'submitting', type: 'submit', variant: frame.manifest.color === 'danger' ? 'destructive' : 'outline' }, () => [frame.manifest.icon ? PanelsIcon(frame.manifest.icon) : null, h('span', frame.phase === 'submitting' ? 'Working…' : 'Run action')]),
      ])
    }

    function trigger(action: VueActionRendererProps['action']): VNode | null {
      if (action.visible === false) return null
      return h(Button, {
        class: 'hp-action-trigger',
        'data-action-id': action.id,
        'data-color': action.color ?? undefined,
        disabled: action.disabled === true || state.value.frames.some(frame => frame.manifest.id === action.id),
        type: 'button',
        variant: action.color === 'danger' ? 'destructive' : 'outline',
        onClick: () => props.store.mount(action),
      }, () => [action.icon ? PanelsIcon(action.icon) : null, h('span', action.label)])
    }

    function modalSlot(frame: ClientActionFrame, placement: 'content' | 'footer'): VNode | null {
      const reference = frame.manifest.modal?.[placement]
      if (!reference || !props.registry) return null
      const Renderer = props.registry.resolve(reference.component, props.panelId, `action modal ${placement}`)
      return h(Renderer, { ...reference.properties, frame } satisfies VueActionSlotProps)
    }

    return () => {
      const actions = props.actions ?? [props.action]
      const grouped = new Set(props.groups?.flatMap(group => group.actions) ?? [])
      return h('div', { class: 'hp-action', 'data-action-mount': props.action.mount }, [
      h('div', { class: 'hp-action-collection' }, [
        ...actions.filter(action => !grouped.has(action.id)).map(trigger),
        ...props.groups?.map(group => {
          const items = group.actions.flatMap(id => {
            const action = actions.find(candidate => candidate.id === id)
            return !action || action.visible === false ? [] : [{ disabled: action.disabled, id, label: action.label }]
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
          h(DropdownMenuTrigger, { asChild: true }, () => h(Button, { variant: 'outline' }, () => [group.icon ? PanelsIcon(group.icon) : null, group.label ?? 'Actions'])),
          h(DropdownMenuContent, { 'data-holo-panel': '' }, () => items.map(item => h(DropdownMenuItem, { disabled: item.disabled, onSelect: () => { const action = actions.find(candidate => candidate.id === item.id); if (action) props.store.mount(action) } }, () => item.label))),
        ])
        }) ?? [],
      ]),
      ...state.value.frames.slice(-1).map((frame, index) => {
        const customName = `action.${frame.manifest.id}`
        const Custom = props.registry?.has(customName, props.panelId)
          ? props.registry.resolve(customName, props.panelId, 'action modal')
          : null
        if (frame.phase === 'confirming') return h(AlertDialog, { key: `${frame.manifest.id}-${index}`, open: true }, () => h(AlertDialogContent, {
          'data-holo-panel': '',
          onEscapeKeyDown: () => props.store.close(),
          onPointerDownOutside: () => props.store.close(),
        }, () => [
          h(AlertDialogHeader, {}, () => [h(AlertDialogTitle, {}, () => frame.manifest.modal?.heading ?? frame.manifest.label), h(AlertDialogDescription, {}, () => frame.manifest.confirmation ?? 'Are you sure?')]),
          h(AlertDialogFooter, {}, () => [h(AlertDialogCancel, { onClick: () => props.store.close() }, () => 'Cancel'), h(AlertDialogAction, {
            variant: frame.manifest.color === 'danger' ? 'destructive' : 'default',
            onClick: (event: MouseEvent) => {
              event.preventDefault()
              props.store.confirm()
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
            frame.phase === 'succeeded' ? h('div', { 'aria-live': 'polite', role: 'status' }, 'Action completed') : null,
            renderHook(ActionsRenderHook.MODAL_CUSTOM_CONTENT_FOOTER_BEFORE),
            modalSlot(frame, 'footer'),
            renderHook(ActionsRenderHook.MODAL_CUSTOM_CONTENT_FOOTER_AFTER),
            h(Footer, {}, () => h(Button, { type: 'button', variant: 'outline', onClick: () => props.store.close() }, () => 'Close')),
          ]))
      }),
    ])
    }
  },
})
