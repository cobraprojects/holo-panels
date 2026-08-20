import {
  computed,
  defineComponent,
  h,
  inject,
  onErrorCaptured,
  provide,
  ref,
  type ComputedRef,
  type InjectionKey,
  type PropType,
  type VNode,
} from 'vue'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
  TabsContent,
  TabsList,
  TabsRoot,
  TabsTrigger,
} from 'reka-ui'
import { ChevronDown, X } from 'lucide-vue-next'
import { ComponentRegistry } from './registry'
import { ShadcnIcon } from './internal-ui'

export interface PanelsDropdownItem {
  readonly id: string
  readonly label: string
  readonly disabled?: boolean
  readonly icon?: string | null
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

const PanelsPortalContext: InjectionKey<ComputedRef<HTMLElement | null>> = Symbol('holo-panels-portal')
const noPortalContainer = computed<HTMLElement | null>(() => null)

export const PanelsPortalProvider = defineComponent({
  name: 'PanelsPortalProvider',
  props: {
    container: { type: Object as PropType<HTMLElement | null>, default: null },
  },
  setup(props, { slots }) {
    provide(PanelsPortalContext, computed(() => props.container))
    return () => slotContent(slots.default)
  },
})

function panelsPortalContainer(): ComputedRef<HTMLElement | null> {
  return inject(PanelsPortalContext, noPortalContainer)
}

function slotContent(slot: (() => VNode[]) | undefined, fallback?: string): VNode[] | string | undefined {
  return slot?.() ?? fallback
}

export const PanelsButton = defineComponent({
  name: 'PanelsButton',
  props: {
    ariaLabel: String,
    disabled: Boolean,
    type: { type: String as PropType<'button' | 'submit' | 'reset'>, default: 'button' },
    variant: { type: String as PropType<'primary' | 'secondary' | 'danger' | 'ghost'>, default: 'primary' },
  },
  emits: ['click'],
  setup(props, { emit, slots }) {
    return () => h('button', {
      'aria-label': props.ariaLabel,
      type: props.type,
      disabled: props.disabled,
      class: ['hp-button', `hp-button--${props.variant}`],
      'data-panels-component': 'button',
      'data-slot': 'button',
      'data-variant': props.variant === 'primary' ? 'default' : props.variant === 'danger' ? 'destructive' : props.variant,
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
      'data-slot': 'button',
      'data-variant': 'link',
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
    return () => h('span', { class: ['hp-badge', `hp-badge--${props.tone}`], 'data-panels-component': 'badge', 'data-slot': 'badge', 'data-variant': props.tone === 'danger' ? 'destructive' : props.tone === 'neutral' ? 'secondary' : props.tone }, slotContent(slots.default))
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
    return () => h('span', { class: 'hp-avatar', 'data-panels-component': 'avatar', 'data-slot': 'avatar' }, props.src
      ? h('img', { src: props.src, alt: props.alt, 'data-slot': 'avatar-image' })
      : h('span', { 'aria-label': props.alt, 'data-slot': 'avatar-fallback' }, props.fallback ?? props.alt.slice(0, 1)))
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
      'data-size': 'icon',
      'data-slot': 'button',
      'data-variant': 'ghost',
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
    return () => h('div', { class: 'hp-field', 'data-panels-component': 'input-wrapper', 'data-slot': 'field' }, [
      h('label', { for: props.inputId, 'data-slot': 'label' }, [props.label, props.required ? h('span', { 'aria-hidden': 'true' }, ' *') : null]),
      props.description ? h('div', { id: descriptionId.value, class: 'hp-field__description', 'data-slot': 'field-description' }, props.description) : null,
      slots.default?.({
        id: props.inputId,
        'aria-describedby': describedBy.value,
        'aria-invalid': props.error ? 'true' : undefined,
        'aria-required': props.required ? 'true' : undefined,
      }),
      props.error ? h('div', { id: errorId.value, class: 'hp-field__error', 'data-slot': 'field-error', role: 'alert' }, props.error) : null,
    ])
  },
})

export const PanelsLoadingIndicator = defineComponent({
  name: 'PanelsLoadingIndicator',
  props: { label: { type: String, default: 'Loading' } },
  setup(props) {
    return () => h('div', { class: 'hp-loading', role: 'status', 'aria-live': 'polite', 'data-panels-component': 'loading-indicator', 'data-slot': 'spinner' }, [
      h('span', { class: 'hp-loading__indicator', 'aria-hidden': 'true' }),
      h('span', { class: 'hp-visually-hidden' }, props.label),
    ])
  },
})

export const PanelsDropdown = defineComponent({
  name: 'PanelsDropdown',
  props: {
    ariaLabel: String,
    label: { type: String, required: true },
    items: { type: Array as PropType<readonly PanelsDropdownItem[]>, required: true },
    open: { type: Boolean as PropType<boolean | undefined>, default: undefined },
    searchable: Boolean,
  },
  emits: ['select', 'update:open'],
  setup(props, { emit }) {
    const search = ref('')
    const portalContainer = panelsPortalContainer()
    const content = (): VNode => h(DropdownMenuContent, { class: 'hp-dropdown__menu', 'data-holo-panel': '', 'data-slot': 'dropdown-menu-content' }, {
      default: () => [
        props.searchable ? h('input', {
          'aria-label': 'Search tenants',
          'data-slot': 'input',
          onInput: (event: Event) => { search.value = (event.currentTarget as HTMLInputElement).value },
          placeholder: 'Search tenants…',
          value: search.value,
        }) : null,
        ...props.items
          .filter(item => !search.value || item.label.toLocaleLowerCase().includes(search.value.toLocaleLowerCase()))
          .map(item => h(DropdownMenuItem, {
            key: item.id,
            disabled: item.disabled,
            textValue: item.label,
            'data-slot': 'dropdown-menu-item',
            onSelect: () => emit('select', item.id),
          }, { default: () => [item.icon ? ShadcnIcon(item.icon) : null, item.label] })),
      ],
    })
    return () => h(DropdownMenuRoot, {
      open: props.open,
      'onUpdate:open': (open: boolean) => emit('update:open', open),
    }, {
      default: () => h('div', { class: 'hp-dropdown', 'data-panels-component': 'dropdown' }, [
        h(DropdownMenuTrigger, { as: 'button', 'aria-label': props.ariaLabel, class: 'hp-dropdown__trigger', type: 'button', 'data-slot': 'dropdown-menu-trigger' }, { default: () => [props.label, h(ChevronDown, { 'aria-hidden': 'true' })] }),
        portalContainer.value
          ? h(DropdownMenuPortal, { to: portalContainer.value }, { default: content })
          : content(),
      ]),
    })
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
      const portalContainer = panelsPortalContainer()
      const surface = (): VNode[] => [
        h(DialogOverlay, { class: 'hp-dialog-overlay', 'data-holo-panel': '', 'data-slot': 'dialog-overlay' }),
        h(DialogContent, {
          'aria-modal': 'true',
          class: className,
          'data-holo-panel': '',
          'data-panels-component': className === 'hp-modal' ? 'modal' : 'slide-over',
          'data-slot': className === 'hp-modal' ? 'dialog-content' : 'sheet-content',
        }, {
          default: () => [
            h(DialogTitle, { as: 'h2', 'data-slot': 'dialog-title' }, { default: () => props.title }),
            props.description ? h(DialogDescription, { as: 'p', 'data-slot': 'dialog-description' }, { default: () => props.description }) : null,
            h('div', { class: `${className}__content` }, slotContent(slots.default)),
            h(DialogClose, { as: 'button', class: 'hp-dialog-close', type: 'button', 'aria-label': props.closeLabel, 'data-slot': 'dialog-close' }, { default: () => h(X, { 'aria-hidden': 'true' }) }),
          ],
        }),
      ]
      return () => h(DialogRoot, {
        open: props.open,
        'onUpdate:open': (open: boolean) => { if (!open) emit('close') },
      }, {
        default: () => portalContainer.value
          ? h(DialogPortal, { to: portalContainer.value }, { default: surface })
          : surface(),
      })
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
    return () => h(TabsRoot, {
      class: 'hp-tabs',
      'data-panels-component': 'tabs',
      'data-slot': 'tabs',
      modelValue: props.modelValue,
      'onUpdate:modelValue': (value: string | number) => emit('update:modelValue', String(value)),
    }, {
      default: () => [
        h(TabsList, { 'aria-label': props.label, 'data-slot': 'tabs-list' }, {
          default: () => props.tabs.map(tab => h(TabsTrigger, {
            key: tab.id,
            as: 'button',
            disabled: tab.disabled,
            type: 'button',
            value: tab.id,
            'data-slot': 'tabs-trigger',
          }, { default: () => tab.label })),
        }),
        ...props.tabs.map(tab => h(TabsContent, { key: tab.id, tabindex: 0, value: tab.id, 'data-slot': 'tabs-content' }, {
          default: () => tab.id === props.modelValue ? slots.default?.({ activeTab: props.modelValue }) : undefined,
        })),
      ],
    })
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
    return () => h('section', { class: 'hp-section', 'data-panels-component': 'section', 'data-slot': 'card' }, [
      h('header', { class: 'hp-section__header', 'data-slot': 'card-header' }, [h('h2', { 'data-slot': 'card-title' }, props.title), props.description ? h('p', { 'data-slot': 'card-description' }, props.description) : null]),
      h('div', { class: 'hp-section__content', 'data-slot': 'card-content' }, slotContent(slots.default)),
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
    return () => h('section', { class: 'hp-empty-state', 'aria-live': 'polite', 'data-panels-component': 'empty-state', 'data-slot': 'empty' }, [
      h('h2', { 'data-slot': 'empty-title' }, props.title),
      props.description ? h('p', { 'data-slot': 'empty-description' }, props.description) : null,
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
    return () => h('nav', { class: 'hp-pagination', 'aria-label': props.label, 'data-panels-component': 'pagination', 'data-slot': 'pagination' }, [
      h('button', { type: 'button', disabled: props.page <= 1, 'data-slot': 'pagination-link', 'data-variant': 'outline', onClick: () => emit('update:page', props.page - 1) }, 'Previous'),
      h('span', { 'aria-live': 'polite', 'data-slot': 'pagination-status' }, `Page ${props.page} of ${props.pages}`),
      h('button', { type: 'button', disabled: props.page >= props.pages, 'data-slot': 'pagination-link', 'data-variant': 'outline', onClick: () => emit('update:page', props.page + 1) }, 'Next'),
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
    return () => h('section', { class: 'hp-toasts', 'aria-label': props.label, 'aria-live': 'polite', 'data-panels-component': 'toast-viewport', 'data-slot': 'toast-viewport' }, props.toasts.map(toast => h('div', {
      key: toast.id,
      class: ['hp-toast', `hp-toast--${toast.tone ?? 'info'}`],
      'data-slot': 'toast',
      'data-variant': toast.tone ?? 'info',
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
