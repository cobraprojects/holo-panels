import type { FieldDefinition } from '@holo-js/forms'
import { deepFreeze } from '../../builders/deep-freeze'
import { ComponentDefaultsApplicator } from '../../defaults/apply-defaults'
import { toJsonValue } from '../../protocol/serialization'
import type { JsonObject } from '../../protocol/json'
import { deriveFieldClientHints, deriveSchemaDefault } from './hints'
import type {
  BoundFormField,
  CompiledFieldDefinition,
  FieldLayout,
  FieldResolvable,
  FieldResolver,
  FormFieldPath,
  FormFieldValue,
} from './types'

interface FieldBuilderState<TValues, TPath extends FormFieldPath<TValues>, TValue, TRecord> {
  label: FieldResolvable<TValues, TPath, string | null, TRecord>
  helperText: FieldResolvable<TValues, TPath, string | null, TRecord>
  hint: FieldResolvable<TValues, TPath, string | null, TRecord>
  placeholder: FieldResolvable<TValues, TPath, string | null, TRecord>
  defaultValue?: FieldResolvable<TValues, TPath, TValue, TRecord>
  visible: FieldResolvable<TValues, TPath, boolean, TRecord>
  disabled: FieldResolvable<TValues, TPath, boolean, TRecord>
  readOnly: FieldResolvable<TValues, TPath, boolean, TRecord>
  required?: boolean
  dependencies: FormFieldPath<TValues>[]
  debounceMilliseconds: number
  layout: FieldLayout
  extraAttributes: JsonObject
  hydrate?: FieldResolver<TValues, TPath, TValue, TRecord>
  dehydrate?: FieldResolver<TValues, TPath, TValue | undefined, TRecord>
}

function literalOrFallback<TValue>(value: unknown, fallback: TValue): TValue {
  return typeof value === 'function' ? fallback : value as TValue
}

function resolverOrUndefined<TResolver>(value: unknown): TResolver | undefined {
  return typeof value === 'function' ? value as TResolver : undefined
}

function normalizeText(value: string | null, name: string): string | null {
  if (value === null) return null
  const normalized = value.trim()
  if (!normalized) throw new Error(`${name} cannot be empty`)
  return normalized
}

function normalizeAttributes(value: Readonly<Record<string, unknown>>): JsonObject {
  const normalized = toJsonValue(value)
  if (typeof normalized !== 'object' || normalized === null || Array.isArray(normalized)) {
    throw new Error('Field extra attributes must be a JSON-safe object')
  }
  return normalized
}

export abstract class FieldBuilder<
  TValues,
  TPath extends FormFieldPath<TValues>,
  TValue = FormFieldValue<TValues, TPath>,
  TType extends string = string,
  TRecord = unknown,
> {
  declare readonly resourceRecordType: TValues
  readonly path: TPath
  readonly type: TType
  readonly schema: FieldDefinition
  readonly #defaults: ComponentDefaultsApplicator<this>
  readonly #state: FieldBuilderState<TValues, TPath, TValue, TRecord>
  #compiled?: CompiledFieldDefinition<TValues, TPath, TValue, TRecord>

  protected constructor(type: TType, binding: BoundFormField<TValues, TPath>) {
    this.type = type
    this.path = binding.path
    this.schema = binding.schema
    this.#defaults = new ComponentDefaultsApplicator('field', type)
    this.#state = {
      label: null,
      helperText: null,
      hint: null,
      placeholder: null,
      visible: true,
      disabled: false,
      readOnly: false,
      dependencies: [],
      debounceMilliseconds: 0,
      layout: {},
      extraAttributes: {},
    }
  }

  label(value: FieldResolvable<TValues, TPath, string | null, TRecord>): this {
    this.assertMutable()
    this.#state.label = typeof value === 'function' ? value : normalizeText(value, 'Field label')
    return this
  }

  helperText(value: FieldResolvable<TValues, TPath, string | null, TRecord>): this {
    this.assertMutable()
    this.#state.helperText = typeof value === 'function' ? value : normalizeText(value, 'Field helper text')
    return this
  }

  hint(value: FieldResolvable<TValues, TPath, string | null, TRecord>): this {
    this.assertMutable()
    this.#state.hint = typeof value === 'function' ? value : normalizeText(value, 'Field hint')
    return this
  }

  placeholder(value: FieldResolvable<TValues, TPath, string | null, TRecord>): this {
    this.assertMutable()
    this.#state.placeholder = typeof value === 'function' ? value : normalizeText(value, 'Field placeholder')
    return this
  }

  default(value: FieldResolvable<TValues, TPath, TValue, TRecord>): this {
    this.assertMutable()
    this.#state.defaultValue = value
    return this
  }

  visible(value: FieldResolvable<TValues, TPath, boolean, TRecord> = true): this {
    this.assertMutable()
    this.#state.visible = value
    return this
  }

  hidden(value: FieldResolvable<TValues, TPath, boolean, TRecord> = true): this {
    this.assertMutable()
    this.#state.visible = typeof value === 'function'
      ? async context => !await value(context)
      : !value
    return this
  }

  disabled(value: FieldResolvable<TValues, TPath, boolean, TRecord> = true): this {
    this.assertMutable()
    this.#state.disabled = value
    return this
  }

  readOnly(value: FieldResolvable<TValues, TPath, boolean, TRecord> = true): this {
    this.assertMutable()
    this.#state.readOnly = value
    return this
  }

  required(value = true): this {
    this.assertMutable()
    this.#state.required = value
    return this
  }

  dependsOn(...paths: readonly FormFieldPath<TValues>[]): this {
    this.assertMutable()
    this.#state.dependencies = [...new Set([...this.#state.dependencies, ...paths])]
    return this
  }

  debounce(milliseconds: number): this {
    this.assertMutable()
    if (!Number.isSafeInteger(milliseconds) || milliseconds < 0) {
      throw new Error('Field debounce must be a non-negative integer')
    }
    this.#state.debounceMilliseconds = milliseconds
    return this
  }

  columnSpan(value: number | 'full'): this {
    this.assertMutable()
    if (value !== 'full' && (!Number.isSafeInteger(value) || value < 1)) {
      throw new Error('Field column span must be a positive integer or full')
    }
    this.#state.layout = { ...this.#state.layout, columnSpan: value }
    return this
  }

  columnStart(value: number): this {
    this.assertMutable()
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new Error('Field column start must be a positive integer')
    }
    this.#state.layout = { ...this.#state.layout, columnStart: value }
    return this
  }

  hydrate(resolver: FieldResolver<TValues, TPath, TValue, TRecord>): this {
    this.assertMutable()
    this.#state.hydrate = resolver
    return this
  }

  dehydrate(resolver: FieldResolver<TValues, TPath, TValue | undefined, TRecord>): this {
    this.assertMutable()
    this.#state.dehydrate = resolver
    return this
  }

  extraAttributes(value: Readonly<Record<string, unknown>>): this {
    this.assertMutable()
    this.#state.extraAttributes = normalizeAttributes(value)
    return this
  }

  compile(): CompiledFieldDefinition<TValues, TPath, TValue, TRecord> {
    if (this.#compiled) return this.#compiled
    this.assertMutable()
    this.assertSchemaKind(this.schema)
    const clientHints = deriveFieldClientHints(this.schema)
    const configuredDefault = this.#state.defaultValue
    const schemaDefault = deriveSchemaDefault<TValue>(this.schema)
    const defaultValue = typeof configuredDefault === 'undefined' ? schemaDefault : literalOrFallback(configuredDefault, undefined)
    const serverDefault = resolverOrUndefined<FieldResolver<TValues, TPath, TValue, TRecord>>(configuredDefault)
    const serverLabel = resolverOrUndefined<FieldResolver<TValues, TPath, string | null, TRecord>>(this.#state.label)
    const serverHelperText = resolverOrUndefined<FieldResolver<TValues, TPath, string | null, TRecord>>(this.#state.helperText)
    const serverHint = resolverOrUndefined<FieldResolver<TValues, TPath, string | null, TRecord>>(this.#state.hint)
    const serverPlaceholder = resolverOrUndefined<FieldResolver<TValues, TPath, string | null, TRecord>>(this.#state.placeholder)
    const serverVisible = resolverOrUndefined<FieldResolver<TValues, TPath, boolean, TRecord>>(this.#state.visible)
    const serverDisabled = resolverOrUndefined<FieldResolver<TValues, TPath, boolean, TRecord>>(this.#state.disabled)
    const serverReadOnly = resolverOrUndefined<FieldResolver<TValues, TPath, boolean, TRecord>>(this.#state.readOnly)
    const required = clientHints.required || this.#state.required === true
    const properties: JsonObject = { ...this.fieldProperties() }
    const definition: CompiledFieldDefinition<TValues, TPath, TValue, TRecord> = {
      kind: 'field',
      type: this.type,
      path: this.path,
      label: literalOrFallback(this.#state.label, null),
      helperText: literalOrFallback(this.#state.helperText, null),
      hint: literalOrFallback(this.#state.hint, null),
      placeholder: literalOrFallback(this.#state.placeholder, null),
      ...(typeof defaultValue === 'undefined' ? {} : { defaultValue }),
      visible: literalOrFallback(this.#state.visible, true),
      disabled: literalOrFallback(this.#state.disabled, false),
      readOnly: literalOrFallback(this.#state.readOnly, false),
      required,
      dependencies: Object.freeze([...this.#state.dependencies]),
      debounceMilliseconds: this.#state.debounceMilliseconds,
      layout: Object.freeze({ ...this.#state.layout }),
      extraAttributes: this.#state.extraAttributes,
      properties,
      clientHints,
      server: Object.freeze({
        ...(serverLabel ? { label: serverLabel } : {}),
        ...(serverHelperText ? { helperText: serverHelperText } : {}),
        ...(serverHint ? { hint: serverHint } : {}),
        ...(serverPlaceholder ? { placeholder: serverPlaceholder } : {}),
        ...(serverDefault ? { defaultValue: serverDefault } : {}),
        ...(serverVisible ? { visible: serverVisible } : {}),
        ...(serverDisabled ? { disabled: serverDisabled } : {}),
        ...(serverReadOnly ? { readOnly: serverReadOnly } : {}),
        ...(this.#state.hydrate ? { hydrate: this.#state.hydrate } : {}),
        ...(this.#state.dehydrate ? { dehydrate: this.#state.dehydrate } : {}),
      }),
    }
    deepFreeze(definition)
    this.#compiled = definition
    return definition
  }

  protected assertMutable(): void {
    this.#defaults.configure(this, Boolean(this.#compiled))
    if (this.#compiled) throw new Error(`Cannot change ${this.type} field after compilation`)
  }

  protected fieldProperties(): JsonObject {
    return {}
  }

  protected abstract assertSchemaKind(definition: FieldDefinition): void
}
