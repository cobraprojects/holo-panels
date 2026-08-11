import { defineComponent, h } from 'vue'
import { Archive, Check, Circle, Download, Eye, Pencil, Play, Plus, RotateCcw, Trash2, Upload, X } from 'lucide-vue-next'

const icons = Object.freeze({
  archive: Archive,
  check: Check,
  circle: Circle,
  close: X,
  delete: Trash2,
  download: Download,
  edit: Pencil,
  play: Play,
  plus: Plus,
  restore: RotateCcw,
  upload: Upload,
  view: Eye,
})

export function ShadcnIcon(name: string) {
  return h(icons[name as keyof typeof icons] ?? Circle, { 'aria-hidden': 'true', 'data-icon': name, 'data-slot': 'icon' })
}

export const ShadcnButton = defineComponent({
  inheritAttrs: false,
  name: 'ShadcnButton',
  setup(_props, { attrs, slots }) {
    return () => h('button', { ...attrs, 'data-slot': 'button', type: attrs.type ?? 'button' }, slots.default?.())
  },
})

export const ShadcnInput = defineComponent({
  inheritAttrs: false,
  name: 'ShadcnInput',
  setup(_props, { attrs, expose }) {
    let element: HTMLInputElement | null = null
    expose({
      focus: (): void => element?.focus(),
    })
    return () => {
      const slot = attrs.type === 'checkbox' ? 'checkbox' : attrs.type === 'radio' ? 'radio-group-item' : attrs.type === 'range' ? 'slider' : 'input'
      const inputAttributes = { ...attrs }
      Reflect.deleteProperty(inputAttributes, 'ref')
      return h('input', {
        ...inputAttributes,
        ref: value => {
          element = value instanceof HTMLInputElement ? value : null
        },
        'data-slot': slot,
      })
    }
  },
})

export const ShadcnSelect = defineComponent({
  inheritAttrs: false,
  name: 'ShadcnSelect',
  setup(_props, { attrs, slots }) {
    return () => h('select', { ...attrs, 'data-slot': 'native-select' }, slots.default?.())
  },
})

export const ShadcnTable = defineComponent({
  inheritAttrs: false,
  name: 'ShadcnTable',
  setup(_props, { attrs, slots }) {
    return () => h('table', { ...attrs, 'data-slot': 'table' }, slots.default?.())
  },
})

export const ShadcnTextarea = defineComponent({
  inheritAttrs: false,
  name: 'ShadcnTextarea',
  setup(_props, { attrs }) {
    return () => h('textarea', { ...attrs, 'data-slot': 'textarea' })
  },
})
