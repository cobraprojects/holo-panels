import type { FieldDefinition, FormSchema, InferFormData } from '@holo-js/forms'
import type { JsonObject, JsonValue } from '../../protocol/json'
import {
  FieldBuilder,
  type BoundFormField,
  type FieldResolver,
  type FormFieldPath,
  type FormFieldValue,
} from '../base'

type TextValue = string | number | null | undefined
type BooleanValue = boolean | null | undefined
type DateValue = Date | null | undefined
type RadioValue = boolean | number | string | null | undefined

function assertSchemaKind(definition: FieldDefinition, allowed: readonly FieldDefinition['kind'][], type: string): void {
  if (!allowed.includes(definition.kind)) {
    throw new Error(`${type} fields cannot bind to Holo ${definition.kind} fields`)
  }
}

function normalizeNonEmpty(value: string, name: string): string {
  const normalized = value.trim()
  if (!normalized) throw new Error(`${name} cannot be empty`)
  return normalized
}

export type TextInputMode = 'email' | 'numeric' | 'password' | 'search' | 'tel' | 'text' | 'url'

export class TextFieldBuilder<
  TValues,
  TPath extends FormFieldPath<TValues>,
  TValue extends TextValue = FormFieldValue<TValues, TPath> & TextValue,
  TRecord = unknown,
> extends FieldBuilder<TValues, TPath, TValue, 'text', TRecord> {
  #inputMode: TextInputMode = 'text'
  #prefix: string | null = null
  #suffix: string | null = null
  #mask: string | null = null
  #autocomplete: string | null = null
  #minimumLength?: number
  #maximumLength?: number
  #datalist: readonly string[] = []
  #revealable = false

  constructor(binding: BoundFormField<TValues, TPath>) {
    super('text', binding)
  }

  email(): this {
    this.assertMutable()
    this.#inputMode = 'email'
    return this
  }

  url(): this {
    this.assertMutable()
    this.#inputMode = 'url'
    return this
  }

  telephone(): this {
    this.assertMutable()
    this.#inputMode = 'tel'
    return this
  }

  password(revealable = false): this {
    this.assertMutable()
    this.#inputMode = 'password'
    this.#revealable = revealable
    return this
  }

  numeric(): this {
    this.assertMutable()
    this.#inputMode = 'numeric'
    return this
  }

  search(): this {
    this.assertMutable()
    this.#inputMode = 'search'
    return this
  }

  prefix(value: string | null): this {
    this.assertMutable()
    this.#prefix = value === null ? null : normalizeNonEmpty(value, 'Text prefix')
    return this
  }

  suffix(value: string | null): this {
    this.assertMutable()
    this.#suffix = value === null ? null : normalizeNonEmpty(value, 'Text suffix')
    return this
  }

  mask(value: string | null): this {
    this.assertMutable()
    this.#mask = value === null ? null : normalizeNonEmpty(value, 'Text mask')
    return this
  }

  autocomplete(value: string | null): this {
    this.assertMutable()
    this.#autocomplete = value === null ? null : normalizeNonEmpty(value, 'Text autocomplete')
    return this
  }

  minLength(value: number): this {
    this.assertMutable()
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('Minimum length must be a non-negative integer')
    this.#minimumLength = value
    return this
  }

  maxLength(value: number): this {
    this.assertMutable()
    if (!Number.isSafeInteger(value) || value < 1) throw new Error('Maximum length must be a positive integer')
    this.#maximumLength = value
    return this
  }

  datalist(values: readonly string[]): this {
    this.assertMutable()
    this.#datalist = Object.freeze([...new Set(values.map(value => normalizeNonEmpty(value, 'Datalist value')))])
    return this
  }

  revealable(value = true): this {
    this.assertMutable()
    this.#revealable = value
    return this
  }

  protected override assertSchemaKind(definition: FieldDefinition): void {
    assertSchemaKind(definition, ['number', 'string'], 'Text')
  }

  protected override fieldProperties(): JsonObject {
    if (typeof this.#minimumLength === 'number' && typeof this.#maximumLength === 'number' && this.#minimumLength > this.#maximumLength) {
      throw new Error('Text minimum length cannot exceed maximum length')
    }
    return {
      inputMode: this.#inputMode,
      prefix: this.#prefix,
      suffix: this.#suffix,
      mask: this.#mask,
      autocomplete: this.#autocomplete,
      revealable: this.#revealable,
      datalist: [...this.#datalist],
      ...(typeof this.#minimumLength === 'number' ? { minimumLength: this.#minimumLength } : {}),
      ...(typeof this.#maximumLength === 'number' ? { maximumLength: this.#maximumLength } : {}),
    }
  }
}

export class TextareaFieldBuilder<
  TValues,
  TPath extends FormFieldPath<TValues>,
  TValue extends string | null | undefined = FormFieldValue<TValues, TPath> & (string | null | undefined),
  TRecord = unknown,
> extends FieldBuilder<TValues, TPath, TValue, 'textarea', TRecord> {
  #rows = 4
  #autosize = false
  #maximumLength?: number

  constructor(binding: BoundFormField<TValues, TPath>) {
    super('textarea', binding)
  }

  rows(value: number): this {
    this.assertMutable()
    if (!Number.isSafeInteger(value) || value < 1) throw new Error('Textarea rows must be a positive integer')
    this.#rows = value
    return this
  }

  autosize(value = true): this {
    this.assertMutable()
    this.#autosize = value
    return this
  }

  maxLength(value: number): this {
    this.assertMutable()
    if (!Number.isSafeInteger(value) || value < 1) throw new Error('Textarea maximum length must be a positive integer')
    this.#maximumLength = value
    return this
  }

  protected override assertSchemaKind(definition: FieldDefinition): void {
    assertSchemaKind(definition, ['string'], 'Textarea')
  }

  protected override fieldProperties(): JsonObject {
    return {
      rows: this.#rows,
      autosize: this.#autosize,
      ...(typeof this.#maximumLength === 'number' ? { maximumLength: this.#maximumLength } : {}),
    }
  }
}

abstract class BooleanFieldBuilder<
  TValues,
  TPath extends FormFieldPath<TValues>,
  TValue extends BooleanValue,
  TType extends 'checkbox' | 'toggle',
  TRecord,
> extends FieldBuilder<TValues, TPath, TValue, TType, TRecord> {
  #onLabel: string | null = null
  #offLabel: string | null = null

  onLabel(value: string | null): this {
    this.assertMutable()
    this.#onLabel = value === null ? null : normalizeNonEmpty(value, 'On label')
    return this
  }

  offLabel(value: string | null): this {
    this.assertMutable()
    this.#offLabel = value === null ? null : normalizeNonEmpty(value, 'Off label')
    return this
  }

  protected override assertSchemaKind(definition: FieldDefinition): void {
    assertSchemaKind(definition, ['boolean'], this.type)
  }

  protected override fieldProperties(): JsonObject {
    return { onLabel: this.#onLabel, offLabel: this.#offLabel }
  }
}

export class CheckboxFieldBuilder<
  TValues,
  TPath extends FormFieldPath<TValues>,
  TValue extends BooleanValue = FormFieldValue<TValues, TPath> & BooleanValue,
  TRecord = unknown,
> extends BooleanFieldBuilder<TValues, TPath, TValue, 'checkbox', TRecord> {
  constructor(binding: BoundFormField<TValues, TPath>) {
    super('checkbox', binding)
  }
}

export class ToggleFieldBuilder<
  TValues,
  TPath extends FormFieldPath<TValues>,
  TValue extends BooleanValue = FormFieldValue<TValues, TPath> & BooleanValue,
  TRecord = unknown,
> extends BooleanFieldBuilder<TValues, TPath, TValue, 'toggle', TRecord> {
  constructor(binding: BoundFormField<TValues, TPath>) {
    super('toggle', binding)
  }
}

export interface RadioOption<TValue extends Exclude<RadioValue, null | undefined>> {
  readonly value: TValue
  readonly label: string
  readonly disabled?: boolean
}

export class RadioFieldBuilder<
  TValues,
  TPath extends FormFieldPath<TValues>,
  TValue extends RadioValue = FormFieldValue<TValues, TPath> & RadioValue,
  TRecord = unknown,
> extends FieldBuilder<TValues, TPath, TValue, 'radio', TRecord> {
  #options: readonly RadioOption<Exclude<TValue, null | undefined>>[] = []
  #inline = false

  constructor(binding: BoundFormField<TValues, TPath>) {
    super('radio', binding)
  }

  options(values: readonly RadioOption<Exclude<TValue, null | undefined>>[]): this {
    this.assertMutable()
    const seen = new Set<JsonValue>()
    this.#options = Object.freeze(values.map(option => {
      if (seen.has(option.value)) throw new Error(`Duplicate radio option value: ${String(option.value)}`)
      seen.add(option.value)
      return Object.freeze({ ...option, label: normalizeNonEmpty(option.label, 'Radio option label') })
    }))
    return this
  }

  inline(value = true): this {
    this.assertMutable()
    this.#inline = value
    return this
  }

  protected override assertSchemaKind(definition: FieldDefinition): void {
    assertSchemaKind(definition, ['boolean', 'number', 'string'], 'Radio')
  }

  protected override fieldProperties(): JsonObject {
    return {
      inline: this.#inline,
      options: this.#options.map(option => ({
        value: option.value as JsonValue,
        label: option.label,
        disabled: option.disabled ?? false,
      })),
    }
  }
}

export type DatePickerMode = 'date' | 'date-time' | 'time'

export class DateFieldBuilder<
  TValues,
  TPath extends FormFieldPath<TValues>,
  TValue extends DateValue = FormFieldValue<TValues, TPath> & DateValue,
  TRecord = unknown,
> extends FieldBuilder<TValues, TPath, TValue, 'date', TRecord> {
  readonly #mode: DatePickerMode
  #minimum: string | null = null
  #maximum: string | null = null

  constructor(binding: BoundFormField<TValues, TPath>, mode: DatePickerMode = 'date') {
    super('date', binding)
    this.#mode = mode
  }

  min(value: Date | string | null): this {
    this.assertMutable()
    this.#minimum = value === null ? null : value instanceof Date ? value.toISOString() : normalizeNonEmpty(value, 'Minimum date')
    return this
  }

  max(value: Date | string | null): this {
    this.assertMutable()
    this.#maximum = value === null ? null : value instanceof Date ? value.toISOString() : normalizeNonEmpty(value, 'Maximum date')
    return this
  }

  protected override assertSchemaKind(definition: FieldDefinition): void {
    assertSchemaKind(definition, ['date'], 'Date')
  }

  protected override fieldProperties(): JsonObject {
    return { mode: this.#mode, minimum: this.#minimum, maximum: this.#maximum }
  }
}

export class HiddenFieldBuilder<
  TValues,
  TPath extends FormFieldPath<TValues>,
  TValue = FormFieldValue<TValues, TPath>,
  TRecord = unknown,
> extends FieldBuilder<TValues, TPath, TValue, 'hidden', TRecord> {
  constructor(binding: BoundFormField<TValues, TPath>) {
    super('hidden', binding)
  }

  protected override assertSchemaKind(_definition: FieldDefinition): void {}
}

export class SliderFieldBuilder<
  TValues,
  TPath extends FormFieldPath<TValues>,
  TValue extends number | null | undefined = FormFieldValue<TValues, TPath> & (number | null | undefined),
  TRecord = unknown,
> extends FieldBuilder<TValues, TPath, TValue, 'slider', TRecord> {
  #minimum = 0
  #maximum = 100
  #step = 1

  constructor(binding: BoundFormField<TValues, TPath>) {
    super('slider', binding)
  }

  range(minimum: number, maximum: number): this {
    this.assertMutable()
    if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum >= maximum) {
      throw new Error('Slider range requires finite ascending bounds')
    }
    this.#minimum = minimum
    this.#maximum = maximum
    return this
  }

  step(value: number): this {
    this.assertMutable()
    if (!Number.isFinite(value) || value <= 0) throw new Error('Slider step must be positive')
    this.#step = value
    return this
  }

  protected override assertSchemaKind(definition: FieldDefinition): void {
    assertSchemaKind(definition, ['number'], 'Slider')
  }

  protected override fieldProperties(): JsonObject {
    return { minimum: this.#minimum, maximum: this.#maximum, step: this.#step }
  }
}

export class ColorFieldBuilder<
  TValues,
  TPath extends FormFieldPath<TValues>,
  TValue extends string | null | undefined = FormFieldValue<TValues, TPath> & (string | null | undefined),
  TRecord = unknown,
> extends FieldBuilder<TValues, TPath, TValue, 'color', TRecord> {
  #format: 'hex' | 'hsl' | 'rgb' = 'hex'
  #alpha = false

  constructor(binding: BoundFormField<TValues, TPath>) {
    super('color', binding)
  }

  format(value: 'hex' | 'hsl' | 'rgb'): this {
    this.assertMutable()
    this.#format = value
    return this
  }

  alpha(value = true): this {
    this.assertMutable()
    this.#alpha = value
    return this
  }

  protected override assertSchemaKind(definition: FieldDefinition): void {
    assertSchemaKind(definition, ['string'], 'Color')
  }

  protected override fieldProperties(): JsonObject {
    return { format: this.#format, alpha: this.#alpha }
  }
}

export type SlugLocalTransform = (value: string) => string

export function defaultSlugTransform(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export class SlugFieldBuilder<
  TValues,
  TPath extends FormFieldPath<TValues>,
  TValue extends string | null | undefined = FormFieldValue<TValues, TPath> & (string | null | undefined),
  TRecord = unknown,
> extends TextFieldBuilder<TValues, TPath, TValue, TRecord> {
  #source?: FormFieldPath<TValues>
  #transform: SlugLocalTransform = defaultSlugTransform
  #serverNormalized = false

  from(path: FormFieldPath<TValues>): this {
    this.assertMutable()
    this.#source = path
    this.dependsOn(path)
    return this
  }

  localTransform(transform: SlugLocalTransform): this {
    this.assertMutable()
    this.#transform = transform
    return this
  }

  transformLocal(value: string): string {
    return this.#transform(value)
  }

  normalizeUsing(resolver: FieldResolver<TValues, TPath, TValue | undefined, TRecord>): this {
    this.assertMutable()
    this.#serverNormalized = true
    return this.dehydrate(resolver)
  }

  protected override fieldProperties(): JsonObject {
    return {
      ...super.fieldProperties(),
      specialization: 'slug',
      source: this.#source ?? null,
      localTransform: 'registered',
      serverNormalized: this.#serverNormalized,
    }
  }
}

export type BasicFormSchema = FormSchema
export type BasicFormValues<TSchema extends BasicFormSchema> = InferFormData<TSchema>
