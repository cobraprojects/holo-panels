import type { JsonObject } from '../protocol/json'
import { toJsonValue } from '../protocol/serialization'
import { deepFreeze } from '../builders/deep-freeze'
import { toSchemaManifest } from '../schemas/manifest'
import type {
  ActionContext,
  ActionDefinition,
  ActionManifest,
  ActionResolvedState,
  ActionResolvable,
} from './contracts'
import { builtInActionPresentation } from './presentation'

const ACTION_ID = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/u

async function resolve<TContext, TValue>(value: ActionResolvable<TContext, TValue>, context: TContext): Promise<TValue> {
  return typeof value === 'function'
    ? (value as (current: TContext) => TValue | Promise<TValue>)(context)
    : value
}

export async function resolveActionState<TRecord, TActor, TTenant, TServices>(
  definition: Pick<ActionDefinition<TRecord, JsonObject, unknown, TActor, TTenant, TServices>, 'disabled' | 'label' | 'visible'>,
  context: ActionContext<TRecord, TActor, TTenant, TServices>,
): Promise<ActionResolvedState> {
  return Object.freeze({
    disabled: definition.disabled ? await resolve(definition.disabled, context) : false,
    label: await resolve(definition.label, context),
    visible: definition.visible ? await resolve(definition.visible, context) : true,
  })
}

export function compileActionManifest<
  TRecord,
  TInput extends JsonObject,
  TResult,
  TActor,
  TTenant,
  TServices,
>(
  definition: ActionDefinition<TRecord, TInput, TResult, TActor, TTenant, TServices>,
  label: string,
  context: ActionContext<TRecord, TActor, TTenant, TServices>,
  state: Pick<ActionResolvedState, 'disabled' | 'visible'> = { disabled: false, visible: true },
): Promise<Readonly<ActionManifest>> {
  return compileManifest(definition, label, context, state)
}

async function compileManifest<TRecord, TInput extends JsonObject, TResult, TActor, TTenant, TServices>(
  definition: ActionDefinition<TRecord, TInput, TResult, TActor, TTenant, TServices>,
  label: string,
  context: ActionContext<TRecord, TActor, TTenant, TServices>,
  state: Pick<ActionResolvedState, 'disabled' | 'visible'>,
): Promise<Readonly<ActionManifest>> {
  if (!ACTION_ID.test(definition.id)) throw new Error('Actions require stable dot or dash separated IDs')
  const normalizedLabel = label.trim()
  if (!normalizedLabel) throw new Error('Action labels cannot be empty')
  if (normalizedLabel.length > 200) throw new Error('Action labels cannot exceed 200 characters')
  if (typeof definition.confirmation === 'string' && definition.confirmation.length > 2000) {
    throw new Error('Action confirmations cannot exceed 2000 characters')
  }
  const defaults = builtInActionPresentation(definition.kind)
  const modal = definition.modal
    ? {
        content: definition.modal.content ?? null,
        description: definition.modal.description === undefined ? null : await resolve(definition.modal.description, context),
        footer: definition.modal.footer ?? null,
        heading: definition.modal.heading === undefined ? null : await resolve(definition.modal.heading, context),
        nestedActions: [...(definition.modal.nestedActions ?? [])],
        schema: definition.modal.schema ? await toSchemaManifest(definition.modal.schema, context) : null,
        slideOver: definition.modal.slideOver ?? false,
        width: definition.modal.width ?? 'medium',
      }
    : null
  if (modal && new Set(modal.nestedActions).size !== modal.nestedActions.length) throw new Error('Action modal nested actions must be unique')
  for (const id of modal?.nestedActions ?? []) {
    if (!ACTION_ID.test(id)) throw new Error('Action modal nested actions require stable IDs')
  }
  const presentation = {
    badge: definition.badge === undefined ? null : await resolve(definition.badge, context),
    color: definition.color === undefined ? defaults?.color ?? null : await resolve(definition.color, context),
    icon: definition.icon === undefined ? defaults?.icon ?? null : await resolve(definition.icon, context),
    size: definition.size ?? 'medium',
    tooltip: definition.tooltip === undefined ? null : await resolve(definition.tooltip, context),
    type: definition.type ?? definition.kind,
  }
  const serialized = toJsonValue({
    ...presentation,
    confirmation: definition.confirmation === undefined ? defaults?.confirmation ?? null : definition.confirmation,
    disabled: state.disabled,
    id: definition.id,
    kind: definition.kind,
    label: normalizedLabel,
    mount: definition.mount,
    modal,
    visible: state.visible,
  })
  if (serialized === null || Array.isArray(serialized) || typeof serialized !== 'object') {
    throw new TypeError('Action manifests must serialize to JSON objects')
  }
  if (JSON.stringify(serialized).length > 65_536) throw new Error('Action manifests cannot exceed 64 KiB')
  deepFreeze(serialized)
  return serialized as unknown as Readonly<ActionManifest>
}
