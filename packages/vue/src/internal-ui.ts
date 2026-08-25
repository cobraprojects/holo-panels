import { h } from 'vue'
import { Archive, ArrowLeft, ArrowRight, Bell, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Circle, Columns3, Copy, Download, Eye, File, FileText, Filter, Folder, Home, Image, KeyRound, Link2, Mail, Menu, MessageSquare, Monitor, Moon, Pencil, Play, Plus, RotateCcw, Search, Sun, Tag, Trash2, Unlink, Upload, User, Users, X } from 'lucide-vue-next'

const icons = Object.freeze({
  archive: Archive,
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  bell: Bell,
  check: Check,
  'check-check': CheckCheck,
  chat: MessageSquare,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'chevron-up': ChevronUp,
  circle: Circle,
  close: X,
  columns: Columns3,
  copy: Copy,
  delete: Trash2,
  download: Download,
  document: File,
  'document-text': FileText,
  edit: Pencil,
  filter: Filter,
  folder: Folder,
  home: Home,
  image: Image,
  key: KeyRound,
  link: Link2,
  mail: Mail,
  menu: Menu,
  monitor: Monitor,
  moon: Moon,
  play: Play,
  plus: Plus,
  restore: RotateCcw,
  search: Search,
  sun: Sun,
  tag: Tag,
  trash: Trash2,
  unlink: Unlink,
  upload: Upload,
  user: User,
  users: Users,
  view: Eye,
  x: X,
})

export function PanelsIcon(name: string, className?: string) {
  const normalized = name === 'chat-bubble-left' || name === 'chat-bubble-left-right' ? 'chat' : name === 'photo' ? 'image' : name
  return h(icons[normalized as keyof typeof icons] ?? Circle, { 'aria-hidden': 'true', class: className, 'data-icon': normalized, 'data-slot': 'icon' })
}

export * from './ui'
