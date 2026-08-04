const PASCAL_NAME = /^[A-Z][A-Za-z0-9]*$/
const PANEL_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
const GUARD_NAME = /^[A-Za-z][A-Za-z0-9_-]*$/

export function assertDefinitionName(value: string | undefined): string {
  if (!value || !PASCAL_NAME.test(value)) {
    throw new Error('[Holo Panels] Definition name must be a PascalCase identifier.')
  }
  return value
}

export function assertPanelId(value: string | undefined): string {
  if (!value || !PANEL_ID.test(value)) {
    throw new Error('[Holo Panels] Panel must be a lower-kebab-case identifier.')
  }
  return value
}

export function assertGuard(value: string | undefined): string {
  if (!value || !GUARD_NAME.test(value)) {
    throw new Error('[Holo Panels] Guard must contain only letters, digits, underscores, and hyphens.')
  }
  return value
}

export function assertPanelPath(value: string | undefined, panel: string): string {
  const path = value ?? `/${panel}`
  if (!/^\/[A-Za-z0-9][A-Za-z0-9/_-]*$/.test(path) || path.includes('//') || path.includes('/../') || path.endsWith('/..')) {
    throw new Error('[Holo Panels] Panel path must be an absolute URL path without traversal segments.')
  }
  return path
}

export function kebabCase(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

export function pluralPascal(value: string): string {
  if (value.endsWith('y') && !/[aeiou]y$/i.test(value)) return `${value.slice(0, -1)}ies`
  if (/(s|x|z|ch|sh)$/i.test(value)) return `${value}es`
  return `${value}s`
}

export function lowerFirst(value: string): string {
  return `${value[0]?.toLowerCase() ?? ''}${value.slice(1)}`
}

export function pascalCase(value: string): string {
  return value
    .split(/[^A-Za-z0-9]+/u)
    .filter(Boolean)
    .map(part => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
    .join('')
}
