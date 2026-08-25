export interface BuiltInActionPresentation {
  readonly color: string | null
  readonly confirmation: string | null
  readonly destructive: boolean
  readonly icon: string
}

const presentations = Object.freeze({
  associate: { color: null, confirmation: null, destructive: false, icon: 'link' },
  attach: { color: null, confirmation: null, destructive: false, icon: 'link' },
  create: { color: 'primary', confirmation: null, destructive: false, icon: 'plus' },
  delete: { color: 'danger', confirmation: 'Are you sure you want to delete this record?', destructive: true, icon: 'delete' },
  detach: { color: 'danger', confirmation: 'Are you sure you want to detach this record?', destructive: true, icon: 'unlink' },
  dissociate: { color: 'danger', confirmation: 'Are you sure you want to dissociate this record?', destructive: true, icon: 'unlink' },
  edit: { color: null, confirmation: null, destructive: false, icon: 'edit' },
  'edit-pivot': { color: null, confirmation: null, destructive: false, icon: 'edit' },
  export: { color: null, confirmation: null, destructive: false, icon: 'download' },
  'force-delete': { color: 'danger', confirmation: 'Are you sure you want to permanently delete this record?', destructive: true, icon: 'delete' },
  import: { color: null, confirmation: null, destructive: false, icon: 'upload' },
  replicate: { color: null, confirmation: null, destructive: false, icon: 'copy' },
  restore: { color: null, confirmation: null, destructive: false, icon: 'restore' },
  view: { color: null, confirmation: null, destructive: false, icon: 'view' },
} satisfies Readonly<Record<string, BuiltInActionPresentation>>)

function canonicalActionName(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/gu, '$1-$2')
    .replace(/-record$/u, '')
    .toLowerCase()
}

export function builtInActionPresentation(name: string): BuiltInActionPresentation | null {
  return presentations[canonicalActionName(name) as keyof typeof presentations] ?? null
}
