import {
  computed,
  defineComponent,
  h,
  nextTick,
  onErrorCaptured,
  ref,
  watch,
  type PropType,
  type VNode,
} from 'vue'
import { ComponentRegistry } from './registry'

export interface PanelsDropdownItem {
  readonly id: string
  readonly label: string
  readonly disabled?: boolean
}

export interface PanelsTabItem {
  readonly id: string
  readonly label: string
  readonly disabled?: boolean
}

export interface PanelsToast {
  readonly id: string
  readonly message: string
  readonly tone?: 'info' | 'success' | 'warning' | 'danger'
}

function slotContent(slot: (() => VNode[]) | undefined, fallback?: string): VNode[] | string | undefined {
  return slot?.() ?? fallback
}

export const PanelsButton = defineComponent({
  name: 'PanelsButton',
  props: {
    disabled: Boolean,
    type: { type: String as PropType<'button' | 'submit' | 'reset'>, default: 'button' },
    variant: { type: String as PropType<'primary' | 'secondary' | 'danger' | 'ghost'>, default: 'primary' },
  },
  emits: ['click'],
  setup(props, { emit, slots }) {
    return () => h('button', {
      type: props.type,
      disabled: props.disabled,
      class: ['hp-button', `hp-button--${props.variant}`],
      'data-panels-component': 'button',
      onClick: (event: unknown) => emit('click', event),
    }, slotContent(slots.default))
  },
})

export const PanelsLink = defineComponent({
  name: 'PanelsLink',
  props: {
    href: { type: String, required: true },
    current: Boolean,
  },
  setup(props, { slots }) {
    return () => h('a', {
      href: props.href,
      class: 'hp-link',
      'data-panels-component': 'link',
      'aria-current': props.current ? 'page' : undefined,
    }, slotContent(slots.default))
  },
})

export const PanelsBadge = defineComponent({
  name: 'PanelsBadge',
  props: {
    tone: { type: String as PropType<'neutral' | 'info' | 'success' | 'warning' | 'danger'>, default: 'neutral' },
  },
  setup(props, { slots }) {
    return () => h('span', { class: ['hp-badge', `hp-badge--${props.tone}`], 'data-panels-component': 'badge' }, slotContent(slots.default))
  },
})

export const PanelsAvatar = defineComponent({
  name: 'PanelsAvatar',
  props: {
    src: String,
    alt: { type: String, required: true },
    fallback: String,
  },
  setup(props) {
    return () => h('span', { class: 'hp-avatar', 'data-panels-component': 'avatar' }, props.src
      ? h('img', { src: props.src, alt: props.alt })
      : h('span', { 'aria-label': props.alt }, props.fallback ?? props.alt.slice(0, 1)))
  },
})

export const PanelsIconButton = defineComponent({
  name: 'PanelsIconButton',
  props: {
    label: { type: String, required: true },
    disabled: Boolean,
  },
  emits: ['click'],
  setup(props, { emit, slots }) {
    return () => h('button', {
      type: 'button',
      class: 'hp-icon-button',
      'data-panels-component': 'icon-button',
      disabled: props.disabled,
      'aria-label': props.label,
      onClick: (event: unknown) => emit('click', event),
    }, slotContent(slots.default))
  },
})

export const PanelsInputWrapper = defineComponent({
  name: 'PanelsInputWrapper',
  props: {
    inputId: { type: String, required: true },
    label: { type: String, required: true },
    description: String,
    error: String,
    required: Boolean,
  },
  setup(props, { slots }) {
    const descriptionId = computed(() => props.description ? `${props.inputId}-description` : undefined)
    const errorId = computed(() => props.error ? `${props.inputId}-error` : undefined)
    const describedBy = computed(() => [descriptionId.value, errorId.value].filter(Boolean).join(' ') || undefined)
    return () => h('div', { class: 'hp-field', 'data-panels-component': 'input-wrapper' }, [
      h('label', { for: props.inputId }, [props.label, props.required ? h('span', { 'aria-hidden': 'true' }, ' *') : null]),
      props.description ? h('div', { id: descriptionId.value, class: 'hp-field__description' }, props.description) : null,
      slots.default?.({
        id: props.inputId,
        'aria-describedby': describedBy.value,
        'aria-invalid': props.error ? 'true' : undefined,
        'aria-required': props.required ? 'true' : undefined,
      }),
      props.error ? h('div', { id: errorId.value, class: 'hp-field__error', role: 'alert' }, props.error) : null,
    ])
  },
})

export const PanelsLoadingIndicator = defineComponent({
  name: 'PanelsLoadingIndicator',
  props: { label: { type: String, default: 'Loading' } },
  setup(props) {
    return () => h('div', { class: 'hp-loading', role: 'status', 'aria-live': 'polite', 'data-panels-component': 'loading-indicator' }, [
      h('span', { class: 'hp-loading__indicator', 'aria-hidden': 'true' }),
      h('span', { class: 'hp-visually-hidden' }, props.label),
    ])
  },
})

export const PanelsDropdown = defineComponent({
  name: 'PanelsDropdown',
  props: {
    label: { type: String, required: true },
    items: { type: Array as PropType<readonly PanelsDropdownItem[]>, required: true },
    open: Boolean,
  },
  emits: ['select', 'update:open'],
  setup(props, { emit }) {
    const activeIndex = ref(0)
    const enabledIndexes = computed(() => props.items.flatMap((item, index) => item.disabled ? [] : [index]))
    function move(direction: 1 | -1): void {
      if (enabledIndexes.value.length === 0) return
      const current = enabledIndexes.value.indexOf(activeIndex.value)
      const next = (Math.max(current, 0) + direction + enabledIndexes.value.length) % enabledIndexes.value.length
      activeIndex.value = enabledIndexes.value[next] ?? 0
    }
    function onKeydown(event: KeyboardEvent): void {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        move(event.key === 'ArrowDown' ? 1 : -1)
      } else if (event.key === 'Escape') {
        emit('update:open', false)
      } else if (event.key === 'Enter' || event.key === ' ') {
        const item = props.items[activeIndex.value]
        if (item && !item.disabled) emit('select', item.id)
      }
    }
    return () => h('div', { class: 'hp-dropdown', 'data-panels-component': 'dropdown' }, [
      h('button', {
        type: 'button',
        class: 'hp-dropdown__trigger',
        'aria-haspopup': 'menu',
        'aria-expanded': String(props.open),
        onClick: () => emit('update:open', !props.open),
        onKeydown,
      }, props.label),
      props.open ? h('ul', { class: 'hp-dropdown__menu', role: 'menu', onKeydown }, props.items.map((item, index) => h('li', {
        key: item.id,
        role: 'menuitem',
        tabindex: index === activeIndex.value ? 0 : -1,
        'aria-disabled': item.disabled ? 'true' : undefined,
        onClick: () => {
          if (!item.disabled) emit('select', item.id)
        },
      }, item.label))) : null,
    ])
  },
})

function dialogComponent(name: string, className: string) {
  return defineComponent({
    name,
    props: {
      open: Boolean,
      title: { type: String, required: true },
      description: String,
      closeLabel: { type: String, default: 'Close' },
    },
    emits: ['close'],
    setup(props, { emit, slots }) {
      const titleId = `${name.toLowerCase()}-title`
      const descriptionId = `${name.toLowerCase()}-description`
      const dialog = ref<HTMLElement>()
      watch(() => props.open, async open => {
        if (!open) return
        await nextTick()
        dialog.value?.querySelector<HTMLElement>('button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])')?.focus()
      }, { immediate: true })
      function onKeydown(event: KeyboardEvent): void {
        if (event.key === 'Escape') {
          emit('close')
          return
        }
        if (event.key !== 'Tab' || !dialog.value) return
        const focusable = Array.from(dialog.value.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
        const first = focusable.at(0)
        const last = focusable.at(-1)
        if (!first || !last) return
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
      return () => props.open ? h('div', {
        ref: dialog,
        class: className,
        'data-panels-component': className === 'hp-modal' ? 'modal' : 'slide-over',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': titleId,
        'aria-describedby': props.description ? descriptionId : undefined,
        onKeydown,
      }, [
        h('h2', { id: titleId }, props.title),
        props.description ? h('p', { id: descriptionId }, props.description) : null,
        h('div', { class: `${className}__content` }, slotContent(slots.default)),
        h('button', { type: 'button', 'aria-label': props.closeLabel, onClick: () => emit('close') }, props.closeLabel),
      ]) : null
    },
  })
}

export const PanelsModal = dialogComponent('PanelsModal', 'hp-modal')
export const PanelsSlideOver = dialogComponent('PanelsSlideOver', 'hp-slide-over')

export const PanelsTabs = defineComponent({
  name: 'PanelsTabs',
  props: {
    tabs: { type: Array as PropType<readonly PanelsTabItem[]>, required: true },
    modelValue: { type: String, required: true },
    label: { type: String, default: 'Sections' },
  },
  emits: ['update:modelValue'],
  setup(props, { emit, slots }) {
    const tabElements = new Map<string, HTMLElement>()
    function selectRelative(current: number, direction: 1 | -1): void {
      const enabled = props.tabs.filter(tab => !tab.disabled)
      const currentEnabled = enabled.findIndex(tab => tab.id === props.tabs[current]?.id)
      const next = (Math.max(currentEnabled, 0) + direction + enabled.length) % enabled.length
      const tab = enabled[next]
      if (!tab) return
      emit('update:modelValue', tab.id)
      void nextTick(() => tabElements.get(tab.id)?.focus())
    }
    return () => h('div', { class: 'hp-tabs', 'data-panels-component': 'tabs' }, [
      h('div', { role: 'tablist', 'aria-label': props.label }, props.tabs.map((tab, index) => h('button', {
        key: tab.id,
        ref: (element: unknown) => {
          if (element instanceof HTMLElement) tabElements.set(tab.id, element)
          else tabElements.delete(tab.id)
        },
        id: `${tab.id}-tab`,
        type: 'button',
        role: 'tab',
        disabled: tab.disabled,
        tabindex: tab.id === props.modelValue ? 0 : -1,
        'aria-selected': String(tab.id === props.modelValue),
        'aria-controls': `${tab.id}-panel`,
        onClick: () => emit('update:modelValue', tab.id),
        onKeydown: (event: KeyboardEvent) => {
          if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
            event.preventDefault()
            selectRelative(index, event.key === 'ArrowRight' ? 1 : -1)
          }
        },
      }, tab.label))),
      h('div', {
        id: `${props.modelValue}-panel`,
        role: 'tabpanel',
        'aria-labelledby': `${props.modelValue}-tab`,
        tabindex: 0,
      }, slots.default?.({ activeTab: props.modelValue })),
    ])
  },
})

export const PanelsTab = defineComponent({
  name: 'PanelsTab',
  props: {
    value: { type: String, required: true },
    selected: Boolean,
    disabled: Boolean,
  },
  emits: ['select'],
  setup(props, { emit, slots }) {
    return () => h('button', {
      type: 'button',
      role: 'tab',
      disabled: props.disabled,
      tabindex: props.selected ? 0 : -1,
      'aria-selected': String(props.selected),
      'data-panels-component': 'tab',
      onClick: () => emit('select', props.value),
    }, slotContent(slots.default))
  },
})

export const PanelsTabPanel = defineComponent({
  name: 'PanelsTabPanel',
  props: {
    value: { type: String, required: true },
    active: Boolean,
  },
  setup(props, { slots }) {
    return () => props.active ? h('div', {
      role: 'tabpanel',
      tabindex: 0,
      'data-panels-component': 'tab-panel',
      'data-panels-value': props.value,
    }, slotContent(slots.default)) : null
  },
})

export const PanelsSection = defineComponent({
  name: 'PanelsSection',
  props: {
    title: { type: String, required: true },
    description: String,
  },
  setup(props, { slots }) {
    return () => h('section', { class: 'hp-section', 'data-panels-component': 'section' }, [
      h('header', { class: 'hp-section__header' }, [h('h2', props.title), props.description ? h('p', props.description) : null]),
      h('div', { class: 'hp-section__content' }, slotContent(slots.default)),
    ])
  },
})

export const PanelsEmptyState = defineComponent({
  name: 'PanelsEmptyState',
  props: {
    title: { type: String, required: true },
    description: String,
  },
  setup(props, { slots }) {
    return () => h('section', { class: 'hp-empty-state', 'aria-live': 'polite', 'data-panels-component': 'empty-state' }, [
      h('h2', props.title),
      props.description ? h('p', props.description) : null,
      slots.default?.(),
    ])
  },
})

export const PanelsPagination = defineComponent({
  name: 'PanelsPagination',
  props: {
    page: { type: Number, required: true },
    pages: { type: Number, required: true },
    label: { type: String, default: 'Pagination' },
  },
  emits: ['update:page'],
  setup(props, { emit }) {
    return () => h('nav', { class: 'hp-pagination', 'aria-label': props.label, 'data-panels-component': 'pagination' }, [
      h('button', { type: 'button', disabled: props.page <= 1, onClick: () => emit('update:page', props.page - 1) }, 'Previous'),
      h('span', { 'aria-live': 'polite' }, `Page ${props.page} of ${props.pages}`),
      h('button', { type: 'button', disabled: props.page >= props.pages, onClick: () => emit('update:page', props.page + 1) }, 'Next'),
    ])
  },
})

export const PanelsToastViewport = defineComponent({
  name: 'PanelsToastViewport',
  props: {
    toasts: { type: Array as PropType<readonly PanelsToast[]>, required: true },
    label: { type: String, default: 'Notifications' },
  },
  setup(props) {
    return () => h('section', { class: 'hp-toasts', 'aria-label': props.label, 'aria-live': 'polite', 'data-panels-component': 'toast-viewport' }, props.toasts.map(toast => h('div', {
      key: toast.id,
      class: ['hp-toast', `hp-toast--${toast.tone ?? 'info'}`],
      role: toast.tone === 'danger' ? 'alert' : 'status',
    }, toast.message)))
  },
})

export const PanelsErrorBoundary = defineComponent({
  name: 'PanelsErrorBoundary',
  setup(_props, { slots }) {
    const error = ref<Error>()
    onErrorCaptured(captured => {
      error.value = captured instanceof Error ? captured : new Error(String(captured))
      return false
    })
    return () => error.value
      ? h('div', { class: 'hp-error-boundary', role: 'alert', 'data-panels-component': 'error-boundary' }, slotContent(slots.fallback, 'Something went wrong'))
      : slotContent(slots.default)
  },
})

export const vueShellComponents = Object.freeze({
  button: PanelsButton,
  link: PanelsLink,
  badge: PanelsBadge,
  avatar: PanelsAvatar,
  'icon-button': PanelsIconButton,
  'input-wrapper': PanelsInputWrapper,
  'loading-indicator': PanelsLoadingIndicator,
  dropdown: PanelsDropdown,
  modal: PanelsModal,
  'slide-over': PanelsSlideOver,
  tabs: PanelsTabs,
  section: PanelsSection,
  'empty-state': PanelsEmptyState,
  pagination: PanelsPagination,
  'toast-viewport': PanelsToastViewport,
  'error-boundary': PanelsErrorBoundary,
})

export function registerVueShellComponents(registry: ComponentRegistry): ComponentRegistry {
  for (const [name, component] of Object.entries(vueShellComponents)) {
    registry.register(name, component, '@holo-js/panels-vue')
  }
  return registry
}

export function createDefaultComponentRegistry(): ComponentRegistry {
  return registerVueShellComponents(new ComponentRegistry())
}
