import type { SVGProps } from 'react'
import { Archive, Bell, Check, ChevronDown, ChevronUp, ChevronsUpDown, Circle, Copy, Download, Eye, File, FileText, Folder, Home, Image, KeyRound, Link2, LogOut, Menu, MessageSquare, Monitor, Moon, Pencil, Play, Plus, RotateCcw, Search, Sun, Tag, Trash2, Unlink, Upload, User, Users, X } from 'lucide-react'

export { Badge } from './ui/badge'
export { Button, buttonVariants, type ButtonVariants } from './ui/button'
export { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card'
export { Checkbox } from './ui/checkbox'
export { Input } from './ui/input'
export { Label } from './ui/label'
export { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from './ui/native-select'
export { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow } from './ui/table'
export { Textarea } from './ui/textarea'

const icons = Object.freeze({
  archive: Archive,
  bell: Bell,
  check: Check,
  chat: MessageSquare,
  'chevron-down': ChevronDown,
  'chevron-up': ChevronUp,
  circle: Circle,
  close: X,
  copy: Copy,
  delete: Trash2,
  download: Download,
  document: File,
  'document-text': FileText,
  edit: Pencil,
  folder: Folder,
  home: Home,
  image: Image,
  key: KeyRound,
  link: Link2,
  'log-out': LogOut,
  menu: Menu,
  monitor: Monitor,
  moon: Moon,
  play: Play,
  plus: Plus,
  restore: RotateCcw,
  search: Search,
  sort: ChevronsUpDown,
  sun: Sun,
  tag: Tag,
  unlink: Unlink,
  upload: Upload,
  user: User,
  users: Users,
  view: Eye,
})

export interface PanelsIconProps extends Omit<SVGProps<SVGSVGElement>, 'ref'> {
  readonly name: string
}

export function PanelsIcon({ name, ...props }: PanelsIconProps) {
  const normalized = name === 'chat-bubble-left' || name === 'chat-bubble-left-right' ? 'chat' : name === 'photo' ? 'image' : name
  const Icon = icons[normalized as keyof typeof icons] ?? Circle
  return <Icon {...props} aria-hidden="true" data-icon={normalized} data-slot="icon" />
}
