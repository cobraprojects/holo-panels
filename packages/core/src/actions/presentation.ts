import type { PanelTranslationKey } from '../translations/presentation'

export interface BuiltInActionPresentation {
  readonly color: string | null
  readonly confirmation: string | null
  readonly destructive: boolean
  readonly icon: string
}

const presentations = Object.freeze({
  associate: { labelTranslationKey: 'actions.associate', color: null, confirmation: null, destructive: false, icon: 'link' },
  attach: { labelTranslationKey: 'actions.attach', color: null, confirmation: null, destructive: false, icon: 'link' },
  create: { labelTranslationKey: 'actions.create', color: 'primary', confirmation: null, destructive: false, icon: 'plus' },
  delete: { labelTranslationKey: 'actions.delete', confirmationTranslationKey: 'actions.confirmDelete', color: 'danger', confirmation: 'Are you sure you want to delete this record?', destructive: true, icon: 'delete' },
  detach: { labelTranslationKey: 'actions.detach', confirmationTranslationKey: 'actions.confirmDetach', color: 'danger', confirmation: 'Are you sure you want to detach this record?', destructive: true, icon: 'unlink' },
  dissociate: { labelTranslationKey: 'actions.dissociate', confirmationTranslationKey: 'actions.confirmDissociate', color: 'danger', confirmation: 'Are you sure you want to dissociate this record?', destructive: true, icon: 'unlink' },
  edit: { labelTranslationKey: 'actions.edit', color: null, confirmation: null, destructive: false, icon: 'edit' },
  'edit-pivot': { labelTranslationKey: 'actions.editPivot', color: null, confirmation: null, destructive: false, icon: 'edit' },
  export: { labelTranslationKey: 'actions.export', color: null, confirmation: null, destructive: false, icon: 'download' },
  'force-delete': { labelTranslationKey: 'actions.forceDelete', confirmationTranslationKey: 'actions.confirmForceDelete', color: 'danger', confirmation: 'Are you sure you want to permanently delete this record?', destructive: true, icon: 'delete' },
  import: { labelTranslationKey: 'actions.import', color: null, confirmation: null, destructive: false, icon: 'upload' },
  replicate: { labelTranslationKey: 'actions.replicate', color: null, confirmation: null, destructive: false, icon: 'copy' },
  restore: { labelTranslationKey: 'actions.restore', color: null, confirmation: null, destructive: false, icon: 'restore' },
  view: { labelTranslationKey: 'actions.view', color: null, confirmation: null, destructive: false, icon: 'view' },
} satisfies Readonly<Record<string, BuiltInActionPresentation & { readonly labelTranslationKey: PanelTranslationKey, readonly confirmationTranslationKey?: PanelTranslationKey }>>)

function canonicalActionName(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/gu, '$1-$2')
    .replace(/-record$/u, '')
    .toLowerCase()
}

export function builtInActionPresentation(name: string): BuiltInActionPresentation | null {
  const presentation = presentations[canonicalActionName(name) as keyof typeof presentations]
  if (!presentation) return null
  const { color, confirmation, destructive, icon } = presentation
  return { color, confirmation, destructive, icon }
}

export function builtInActionTranslationKeys(name: string): { readonly label: PanelTranslationKey, readonly confirmation?: PanelTranslationKey } | undefined {
  const presentation = presentations[canonicalActionName(name) as keyof typeof presentations]
  return presentation ? { label: presentation.labelTranslationKey, ...('confirmationTranslationKey' in presentation ? { confirmation: presentation.confirmationTranslationKey } : {}) } : undefined
}
