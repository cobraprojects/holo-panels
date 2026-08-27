import type { ActionManifest, JsonObject, JsonValue } from '@holo-js/panels-core'

function object(value: JsonValue | undefined): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function nullableStrings(value: JsonObject, keys: readonly string[]): boolean {
  return keys.every(key => value[key] === null || typeof value[key] === 'string')
}

function modal(value: JsonValue | undefined): boolean {
  if (value === null) return true
  if (!object(value)) return false
  return typeof value.alignment === 'string' && ['center', 'end', 'start'].includes(value.alignment)
    && typeof value.width === 'string' && ['small', 'medium', 'large', 'extra-large', 'screen'].includes(value.width)
    && ['autofocus', 'closeByClickingAway', 'closeByEscaping', 'slideOver', 'stickyFooter', 'stickyHeader'].every(key => typeof value[key] === 'boolean')
    && nullableStrings(value, ['cancelActionLabel', 'description', 'heading', 'icon', 'iconColor', 'submitActionLabel'])
    && ['content', 'footer', 'schema'].every(key => value[key] === null || object(value[key]))
    && Array.isArray(value.nestedActions) && value.nestedActions.every(id => typeof id === 'string')
}

export function isActionManifest(value: JsonValue | undefined, id: string): value is JsonObject & ActionManifest {
  return object(value) && value.id === id && typeof value.mount === 'string' && ['page', 'record', 'bulk', 'modal', 'notification'].includes(value.mount)
    && typeof value.label === 'string' && value.label.length > 0 && value.label.length <= 200
    && typeof value.type === 'string'
    && typeof value.kind === 'string' && ['associate', 'attach', 'create', 'custom', 'delete', 'detach', 'dissociate', 'edit', 'editPivot', 'force-delete', 'replicate', 'restore', 'view'].includes(value.kind)
    && typeof value.size === 'string' && ['extra-small', 'small', 'medium', 'large', 'extra-large'].includes(value.size)
    && typeof value.visible === 'boolean' && typeof value.disabled === 'boolean'
    && nullableStrings(value, ['badge', 'color', 'confirmation', 'icon', 'tooltip'])
    && modal(value.modal)
}

export function actionManifestCollection(actions: readonly ActionManifest[], depth = 0): readonly ActionManifest[] {
  if (depth > 10) throw new Error('Nested actions cannot exceed ten levels')
  return actions.flatMap(action => [action, ...actionManifestCollection(action.modal?.actions ?? [], depth + 1)])
}
