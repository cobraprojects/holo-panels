import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TableHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { Archive, Check, Circle, Download, Eye, Pencil, Play, Plus, RotateCcw, Trash2, Upload, X } from 'lucide-react'

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

export function ShadcnIcon({ name }: { readonly name: string }) {
  const Icon = icons[name as keyof typeof icons] ?? Circle
  return <Icon aria-hidden="true" data-icon={name} data-slot="icon" />
}

export const ShadcnButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(function ShadcnButton(
  { type = 'button', ...props },
  ref,
) {
  return <button {...props} data-slot="button" ref={ref} type={type} />
})

export const ShadcnInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function ShadcnInput(props, ref) {
  const slot = props.type === 'checkbox' ? 'checkbox' : props.type === 'radio' ? 'radio-group-item' : props.type === 'range' ? 'slider' : 'input'
  return <input {...props} data-slot={slot} ref={ref} />
})

export const ShadcnTextarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function ShadcnTextarea(props, ref) {
  return <textarea {...props} data-slot="textarea" ref={ref} />
})

export const ShadcnSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function ShadcnSelect(props, ref) {
  return <select {...props} data-slot="native-select" ref={ref} />
})

export const ShadcnTable = forwardRef<HTMLTableElement, TableHTMLAttributes<HTMLTableElement>>(function ShadcnTable(props, ref) {
  return <table {...props} data-slot="table" ref={ref} />
})
