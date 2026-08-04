import { defineComponent, h, onScopeDispose, shallowRef, type PropType, type VNode } from 'vue'
import type { ClientActionFrame, ClientActionState, JsonObject } from '@holo-js/panels-client'
import { PanelsDropdown, PanelsModal, PanelsSlideOver } from '../primitives'
import { createComponentRegistry } from '../registry'
import { VueSchemaRenderer } from '../schemas/renderer'
import type { VueActionCustomProps, VueActionRendererProps, VueActionSlotProps } from './types'

const emptyRegistry = createComponentRegistry()

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
    const state = shallowRef<ClientActionState>(props.store.state)
    const openGroups = shallowRef<ReadonlySet<string>>(new Set())
    const unsubscribe = props.store.subscribe(next => {
      state.value = next
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
          ? h(VueSchemaRenderer, {
              panelId: props.panelId ?? 'default',
              registry: props.registry ?? emptyRegistry,
              schema: frame.manifest.modal.schema,
            })
          : null,
        h('button', { disabled: frame.phase === 'submitting', type: 'submit' }, frame.phase === 'submitting' ? 'Working…' : 'Run action'),
      ])
    }

    function trigger(action: VueActionRendererProps['action']): VNode | null {
      if (action.visible === false) return null
      return h('button', {
        'data-action-id': action.id,
        disabled: action.disabled === true || state.value.frames.some(frame => frame.manifest.id === action.id),
        type: 'button',
        onClick: () => props.store.mount(action),
      }, action.label)
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
        ...props.groups?.map(group => h('span', { 'data-action-color': group.color ?? undefined, 'data-action-icon': group.icon ?? undefined }, [h(PanelsDropdown, {
          items: group.actions.flatMap(id => {
            const action = actions.find(candidate => candidate.id === id)
            return !action || action.visible === false ? [] : [{ disabled: action.disabled, id, label: action.label }]
          }),
          label: group.label ?? 'Actions',
          open: openGroups.value.has(group.id),
          onSelect: (id: string) => {
            const action = actions.find(candidate => candidate.id === id)
            if (action) props.store.mount(action)
          },
          'onUpdate:open': (open: boolean) => {
            const next = new Set(openGroups.value)
            if (open) next.add(group.id)
            else next.delete(group.id)
            openGroups.value = next
          },
        })])) ?? [],
      ]),
      ...state.value.frames.slice(-1).map((frame, index) => {
        const customName = `action.${frame.manifest.id}`
        const Custom = props.registry?.has(customName, props.panelId)
          ? props.registry.resolve(customName, props.panelId, 'action modal')
          : null
        const content = frame.phase === 'confirming'
          ? [h('p', frame.manifest.confirmation ?? ''), h('button', { type: 'button', onClick: () => props.store.confirm() }, 'Confirm')]
          : Custom
            ? [h(Custom, {
                frame,
                setInput: (input: JsonObject) => props.store.setInput(input),
                submit,
              } satisfies VueActionCustomProps)]
            : [form(frame)]
        const Surface = frame.manifest.modal?.slideOver ? PanelsSlideOver : PanelsModal
        return h(Surface, {
          key: `${frame.manifest.id}-${index}`,
          open: true,
          description: frame.manifest.modal?.description ?? undefined,
          title: frame.manifest.modal?.heading ?? frame.manifest.label,
          onClose: () => props.store.close(),
        }, {
          default: () => [h('div', { 'data-modal-width': frame.manifest.modal?.width ?? 'medium' }, [
            modalSlot(frame, 'content'),
            ...content,
            ...frame.manifest.modal?.nestedActions.flatMap(id => {
              const action = actions.find(candidate => candidate.id === id)
              return action ? [trigger(action)] : []
            }) ?? [],
            frame.error ? h('div', { role: 'alert' }, frame.error) : null,
            frame.phase === 'succeeded' ? h('div', { 'aria-live': 'polite', role: 'status' }, 'Action completed') : null,
            modalSlot(frame, 'footer'),
          ])],
        })
      }),
    ])
    }
  },
})
