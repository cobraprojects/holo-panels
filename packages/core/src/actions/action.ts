import type { JsonObject } from '../protocol/json'
import { createPanelTranslator } from '../translations/presentation'
import { toJsonValue } from '../protocol/serialization'
import { deepFreeze } from '../builders/deep-freeze'
import { toSchemaManifest } from '../schemas/manifest'
import type {
  ActionPresentationContext,
  ActionDefinition,
  ActionManifest,
  ActionResolvedState,
  ActionResolvable,
} from './contracts'
import type { CompiledSchema } from '../schemas/contracts'
import { builtInActionPresentation } from './presentation'
import { registeredActionChildren } from './registration'

const ACTION_ID = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/u

async function resolve<TContext, TValue>(value: ActionResolvable<TContext, TValue>, context: TContext): Promise<TValue> {
  return typeof value === 'function'
    ? (value as (current: TContext) => TValue | Promise<TValue>)(context)
    : value
}

function isCompiledSchema<TContext>(value: CompiledSchema<JsonObject, TContext> | JsonObject): value is CompiledSchema<JsonObject, TContext> {
  return Reflect.get(value, 'kind') === 'schema' && Array.isArray(Reflect.get(value, 'components'))
}

async function modalSchema<TContext>(value: CompiledSchema<JsonObject, TContext> | JsonObject | undefined, context: TContext): Promise<JsonObject | null> {
  if (!value) return null
  const serialized = toJsonValue(isCompiledSchema(value) ? await toSchemaManifest(value, context) : value)
  if (!serialized || Array.isArray(serialized) || typeof serialized !== 'object') throw new TypeError('Action modal schemas must serialize to JSON objects')
  return serialized
}

export async function resolveActionState<TRecord, TInput extends JsonObject, TActor, TTenant, TServices>(
  definition: Pick<ActionDefinition<TRecord, TInput, unknown, TActor, TTenant, TServices>, 'disabled' | 'label' | 'labelTranslationKey' | 'visible'>,
  context: ActionPresentationContext<TRecord, TInput, TActor, TTenant, TServices>,
): Promise<ActionResolvedState> {
  return Object.freeze({
    disabled: definition.disabled ? await resolve(definition.disabled, context) : false,
    label: definition.labelTranslationKey ? createPanelTranslator(context.locale ?? 'en')(definition.labelTranslationKey) : await resolve(definition.label, context),
    visible: definition.visible === undefined ? true : await resolve(definition.visible, context),
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
  context: ActionPresentationContext<TRecord, TInput, TActor, TTenant, TServices>,
  state: Pick<ActionResolvedState, 'disabled' | 'visible'> = { disabled: false, visible: true },
): Promise<Readonly<ActionManifest>> {
  return compileManifest(definition, label, context, state)
}

async function compileManifest<TRecord, TInput extends JsonObject, TResult, TActor, TTenant, TServices>(
  definition: ActionDefinition<TRecord, TInput, TResult, TActor, TTenant, TServices>,
  label: string,
  context: ActionPresentationContext<TRecord, TInput, TActor, TTenant, TServices>,
  state: Pick<ActionResolvedState, 'disabled' | 'visible'>,
  depth = 0,
): Promise<Readonly<ActionManifest>> {
  if (depth > 10) throw new Error('Nested actions cannot exceed ten levels')
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
        ...(definition.nestedActions?.length ? { actions: await Promise.all(registeredActionChildren(definition).map(async child => {
          const resolved = await resolveActionState(child, context)
          return compileManifest(child, resolved.label, context, resolved, depth + 1)
        })) } : {}),
        alignment: definition.modal.alignment ?? 'center',
        autofocus: definition.modal.autofocus ?? true,
        cancelActionLabel: definition.modal.cancelActionLabel ?? null,
        closeByClickingAway: definition.modal.closeByClickingAway ?? true,
        closeByEscaping: definition.modal.closeByEscaping ?? true,
        content: definition.modal.content ?? null,
        description: definition.modal.description === undefined ? null : await resolve(definition.modal.description, context),
        footer: definition.modal.footer ?? null,
        heading: definition.modal.heading === undefined ? null : await resolve(definition.modal.heading, context),
        icon: definition.modal.icon ?? null,
        iconColor: definition.modal.iconColor ?? null,
        nestedActions: [...(definition.modal.nestedActions ?? [])],
        readOnlyPresentation: definition.modal.readOnlyPresentation ?? null,
        schema: await modalSchema(definition.modal.schema, context),
        slideOver: definition.modal.slideOver ?? false,
        stickyFooter: definition.modal.stickyFooter ?? false,
        stickyHeader: definition.modal.stickyHeader ?? false,
        submitActionLabel: definition.modal.submitActionLabel ?? null,
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
    ...(definition.mount === 'bulk' ? { deselectAfterCompletion: definition.bulk?.deselectAfterCompletion ?? false } : {}),
    confirmation: definition.confirmationTranslationKey
      ? createPanelTranslator(context.locale ?? 'en')(definition.confirmationTranslationKey)
      : definition.confirmation === undefined ? defaults?.confirmation ?? null : definition.confirmation,
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
