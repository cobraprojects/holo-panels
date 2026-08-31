import type {
  CompiledFieldDefinition,
  FieldPresentationState,
  FieldResolverContext,
  FormFieldPath,
} from './types'

export async function resolveFieldProperty<TValue, TContext>(
  literal: TValue,
  resolver: ((context: TContext) => TValue | Promise<TValue>) | undefined,
  context: TContext,
): Promise<TValue> {
  return resolver ? resolver(context) : literal
}

export async function hydrateFieldValue<
  TValues,
  TPath extends FormFieldPath<TValues>,
  TValue,
  TRecord = unknown,
>(
  definition: CompiledFieldDefinition<TValues, TPath, TValue, TRecord>,
  context: FieldResolverContext<TValues, TPath, TRecord>,
): Promise<TValue> {
  return definition.server.hydrate ? definition.server.hydrate(context) : context.value as TValue
}

export async function resolveFieldDefault<
  TValues,
  TPath extends FormFieldPath<TValues>,
  TValue,
  TRecord = unknown,
>(
  definition: CompiledFieldDefinition<TValues, TPath, TValue, TRecord>,
  context: FieldResolverContext<TValues, TPath, TRecord>,
): Promise<TValue | undefined> {
  if (definition.server.defaultValue) return definition.server.defaultValue(context)
  return definition.defaultValue
}

export async function dehydrateFieldValue<
  TValues,
  TPath extends FormFieldPath<TValues>,
  TValue,
  TRecord = unknown,
>(
  definition: CompiledFieldDefinition<TValues, TPath, TValue, TRecord>,
  context: FieldResolverContext<TValues, TPath, TRecord>,
): Promise<TValue | undefined> {
  const [disabled, readOnly] = await Promise.all([
    resolveFieldProperty(definition.disabled, definition.server.disabled, context),
    resolveFieldProperty(definition.readOnly, definition.server.readOnly, context),
  ])
  if (disabled || readOnly) return undefined
  return definition.server.dehydrate ? definition.server.dehydrate(context) : context.value as TValue
}

export async function resolveFieldPresentationState<
  TValues,
  TPath extends FormFieldPath<TValues>,
  TValue,
  TRecord = unknown,
>(
  definition: CompiledFieldDefinition<TValues, TPath, TValue, TRecord>,
  context: FieldResolverContext<TValues, TPath, TRecord>,
  errors: readonly string[] = [],
): Promise<FieldPresentationState<TValue>> {
  const [value, visible, disabled, readOnly, label, helperText, hint, placeholder] = await Promise.all([
    hydrateFieldValue(definition, context),
    resolveFieldProperty(definition.visible, definition.server.visible, context),
    resolveFieldProperty(definition.disabled, definition.server.disabled, context),
    resolveFieldProperty(definition.readOnly, definition.server.readOnly, context),
    resolveFieldProperty(definition.label, definition.server.label, context),
    resolveFieldProperty(definition.helperText, definition.server.helperText, context),
    resolveFieldProperty(definition.hint, definition.server.hint, context),
    resolveFieldProperty(definition.placeholder, definition.server.placeholder, context),
  ])
  return Object.freeze({
    value,
    errors: Object.freeze([...errors]),
    visible,
    disabled,
    readOnly,
    required: definition.required,
    label,
    helperText,
    hint,
    placeholder,
  })
}
