export type SvelteShellPrimitiveName =
  | 'avatar'
  | 'badge'
  | 'button'
  | 'dropdown'
  | 'empty-state'
  | 'error-boundary'
  | 'icon-button'
  | 'input-wrapper'
  | 'link'
  | 'loading-indicator'
  | 'modal'
  | 'pagination'
  | 'section'
  | 'slide-over'
  | 'tabs'
  | 'toast-viewport'

export interface SvelteShellPrimitive {
  readonly attributes: Readonly<Record<string, string>>
  readonly name: SvelteShellPrimitiveName
  readonly tag: string
}

const interactiveRoles: Partial<Record<SvelteShellPrimitiveName, string>> = {
  dropdown: 'menu',
  modal: 'dialog',
  'slide-over': 'dialog',
  tabs: 'tablist',
  'toast-viewport': 'status',
}

const tags: Record<SvelteShellPrimitiveName, string> = {
  avatar: 'span',
  badge: 'span',
  button: 'button',
  dropdown: 'div',
  'empty-state': 'section',
  'error-boundary': 'section',
  'icon-button': 'button',
  'input-wrapper': 'div',
  link: 'a',
  'loading-indicator': 'span',
  modal: 'div',
  pagination: 'nav',
  section: 'section',
  'slide-over': 'aside',
  tabs: 'div',
  'toast-viewport': 'div',
}

function primitive(name: SvelteShellPrimitiveName, attributes: Readonly<Record<string, string>> = {}): SvelteShellPrimitive {
  const role = interactiveRoles[name]
  const semantics: Record<string, string> = {
    class: `hp-${name}`,
    'data-hp-primitive': name,
    ...attributes,
  }
  if (role) semantics.role = role
  if (name === 'modal' || name === 'slide-over') semantics['aria-modal'] = 'true'
  if (name === 'loading-indicator') {
    semantics.role = 'status'
    semantics['aria-live'] = 'polite'
  }
  if (name === 'toast-viewport') semantics['aria-live'] = 'polite'
  return Object.freeze({ attributes: Object.freeze(semantics), name, tag: tags[name] })
}

export const SvelteAvatar = primitive('avatar')
export const SvelteBadge = primitive('badge')
export const SvelteButton = primitive('button', { type: 'button' })
export const SvelteDropdown = primitive('dropdown')
export const SvelteEmptyState = primitive('empty-state')
export const SvelteErrorBoundary = primitive('error-boundary', { role: 'alert' })
export const SvelteIconButton = primitive('icon-button', { type: 'button' })
export const SvelteInputWrapper = primitive('input-wrapper')
export const SvelteLink = primitive('link')
export const SvelteLoadingIndicator = primitive('loading-indicator')
export const SvelteModal = primitive('modal')
export const SveltePagination = primitive('pagination', { 'aria-label': 'Pagination' })
export const SvelteSection = primitive('section')
export const SvelteSlideOver = primitive('slide-over')
export const SvelteTabs = primitive('tabs')
export const SvelteToastViewport = primitive('toast-viewport')

export const svelteShellPrimitives = Object.freeze({
  avatar: SvelteAvatar,
  badge: SvelteBadge,
  button: SvelteButton,
  dropdown: SvelteDropdown,
  'empty-state': SvelteEmptyState,
  'error-boundary': SvelteErrorBoundary,
  'icon-button': SvelteIconButton,
  'input-wrapper': SvelteInputWrapper,
  link: SvelteLink,
  'loading-indicator': SvelteLoadingIndicator,
  modal: SvelteModal,
  pagination: SveltePagination,
  section: SvelteSection,
  'slide-over': SvelteSlideOver,
  tabs: SvelteTabs,
  'toast-viewport': SvelteToastViewport,
})

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function renderSvelteShellPrimitive(
  definition: SvelteShellPrimitive,
  content = '',
  attributes: Readonly<Record<string, string>> = {},
): string {
  const merged = { ...definition.attributes, ...attributes }
  const serialized = Object.entries(merged)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => ` ${escapeHtml(name)}="${escapeHtml(value)}"`)
    .join('')
  return `<${definition.tag}${serialized}>${escapeHtml(content)}</${definition.tag}>`
}
