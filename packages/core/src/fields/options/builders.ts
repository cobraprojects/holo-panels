import type { FieldDefinition, FormSchema, InferFormData } from '@holo-js/forms'
import type { JsonObject } from '../../protocol/json'
import {
  FieldBuilder,
  FormSchemaBinding,
  type BoundFormField,
  type CompiledFieldDefinition,
  type FieldResolverContext,
  type FormFieldPath,
  type FormFieldValue,
} from '../base'
import type { ChoiceOption, OptionSource, OptionValue } from './contracts'
import { StaticOptionSource } from './sources'

export type ChoiceFieldType = 'checkbox-list' | 'multiselect' | 'select' | 'toggle-buttons'

export interface CompiledChoiceFieldDefinition<
  TValues,
  TPath extends FormFieldPath<TValues>,
  TValue,
  TOptionValue extends OptionValue,
  TRecord,
> extends CompiledFieldDefinition<TValues, TPath, TValue, TRecord> {
  readonly server: CompiledFieldDefinition<TValues, TPath, TValue, TRecord>['server'] & {
    readonly options: OptionSource<TOptionValue, FieldResolverContext<TValues, TPath, TRecord>>
  }
}

function normalizeIdentifier(value: string, name: string): string {
  const normalized = value.trim()
  if (!/^[a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)*$/iu.test(normalized)) {
    throw new Error(`[Holo Panels] Invalid ${name} "${value}".`)
  }
  return normalized
}

export class ChoiceFieldBuilder<
  TValues,
  TPath extends FormFieldPath<TValues>,
  TValue = FormFieldValue<TValues, TPath>,
  TOptionValue extends OptionValue = Extract<NonNullable<TValue> extends readonly (infer TItem)[] ? TItem : NonNullable<TValue>, OptionValue>,
  TType extends ChoiceFieldType = ChoiceFieldType,
  TRecord = unknown,
> extends FieldBuilder<TValues, TPath, TValue, TType, TRecord> {
  #source: OptionSource<TOptionValue, FieldResolverContext<TValues, TPath, TRecord>> = new StaticOptionSource([])
  #relationship: { readonly name: string, readonly titleColumn: string } | null = null
  #searchable = false
  #preload = false
  #paginated = true
  #multiple: boolean
  #canCreateOption = false
  #canEditOption = false
  #preserveOnDependencyChange = false
  #compiledChoice?: CompiledChoiceFieldDefinition<TValues, TPath, TValue, TOptionValue, TRecord>

  constructor(type: TType, binding: BoundFormField<TValues, TPath>) {
    super(type, binding)
    this.#multiple = type === 'multiselect' || type === 'checkbox-list'
  }

  options(
    options: readonly ChoiceOption<TOptionValue>[] | OptionSource<TOptionValue, FieldResolverContext<TValues, TPath, TRecord>>,
  ): this {
    this.assertMutable()
    this.#source = Array.isArray(options)
      ? new StaticOptionSource(options)
      : options as OptionSource<TOptionValue, FieldResolverContext<TValues, TPath, TRecord>>
    return this
  }

  relationship(
    name: string,
    titleColumn: string,
    source: OptionSource<TOptionValue, FieldResolverContext<TValues, TPath, TRecord>>,
  ): this {
    this.assertMutable()
    this.#relationship = Object.freeze({
      name: normalizeIdentifier(name, 'relationship name'),
      titleColumn: normalizeIdentifier(titleColumn, 'relationship title column'),
    })
    this.#source = source
    return this
  }

  searchable(value = true): this {
    this.assertMutable()
    this.#searchable = value
    return this
  }

  preload(value = true): this {
    this.assertMutable()
    this.#preload = value
    return this
  }

  paginated(value = true): this {
    this.assertMutable()
    this.#paginated = value
    return this
  }

  multiple(value = true): this {
    this.assertMutable()
    this.#multiple = value
    return this
  }

  createOption(value = true): this {
    this.assertMutable()
    this.#canCreateOption = value
    return this
  }

  editOption(value = true): this {
    this.assertMutable()
    this.#canEditOption = value
    return this
  }

  preserveWhenDependencyChanges(value = true): this {
    this.assertMutable()
    this.#preserveOnDependencyChange = value
    return this
  }

  override compile(): CompiledChoiceFieldDefinition<TValues, TPath, TValue, TOptionValue, TRecord> {
    if (this.#compiledChoice) return this.#compiledChoice
    const field = super.compile()
    if (this.#canCreateOption && !this.#source.create) throw new Error(`[Holo Panels] ${this.type} option source does not support creation.`)
    if (this.#canEditOption && !this.#source.edit) throw new Error(`[Holo Panels] ${this.type} option source does not support editing.`)
    this.#compiledChoice = Object.freeze({
      ...field,
      server: Object.freeze({ ...field.server, options: this.#source }),
    })
    return this.#compiledChoice
  }

  protected override assertSchemaKind(definition: FieldDefinition): void {
    const requiredKind = this.#multiple ? 'array' : ['number', 'string']
    const valid = Array.isArray(requiredKind) ? requiredKind.includes(definition.kind) : definition.kind === requiredKind
    if (!valid) throw new Error(`${this.type} fields cannot bind to Holo ${definition.kind} fields`)
  }

  protected override fieldProperties(): JsonObject {
    return {
      optionSource: this.#source.kind,
      searchable: this.#searchable,
      preload: this.#preload,
      paginated: this.#paginated,
      multiple: this.#multiple,
      canCreateOption: this.#canCreateOption,
      canEditOption: this.#canEditOption,
      preserveOnDependencyChange: this.#preserveOnDependencyChange,
      ...(this.#relationship ? { relationship: this.#relationship.name, relationshipTitleColumn: this.#relationship.titleColumn } : {}),
    }
  }
}

export class ChoiceFieldFactory<TSchema extends FormSchema> {
  readonly #binding: FormSchemaBinding<TSchema>

  constructor(schema: TSchema) {
    this.#binding = new FormSchemaBinding(schema)
  }

  select<TPath extends FormFieldPath<InferFormData<TSchema>>>(path: TPath): ChoiceFieldBuilder<InferFormData<TSchema>, TPath, FormFieldValue<InferFormData<TSchema>, TPath>, Extract<NonNullable<FormFieldValue<InferFormData<TSchema>, TPath>>, OptionValue>, 'select'> {
    return new ChoiceFieldBuilder('select', this.#binding.bind(path))
  }

  multiselect<TPath extends FormFieldPath<InferFormData<TSchema>>>(path: TPath): ChoiceFieldBuilder<InferFormData<TSchema>, TPath, FormFieldValue<InferFormData<TSchema>, TPath>, Extract<NonNullable<FormFieldValue<InferFormData<TSchema>, TPath>> extends readonly (infer TItem)[] ? TItem : never, OptionValue>, 'multiselect'> {
    return new ChoiceFieldBuilder('multiselect', this.#binding.bind(path))
  }

  checkboxList<TPath extends FormFieldPath<InferFormData<TSchema>>>(path: TPath): ChoiceFieldBuilder<InferFormData<TSchema>, TPath, FormFieldValue<InferFormData<TSchema>, TPath>, Extract<NonNullable<FormFieldValue<InferFormData<TSchema>, TPath>> extends readonly (infer TItem)[] ? TItem : never, OptionValue>, 'checkbox-list'> {
    return new ChoiceFieldBuilder('checkbox-list', this.#binding.bind(path))
  }

  toggleButtons<TPath extends FormFieldPath<InferFormData<TSchema>>>(path: TPath): ChoiceFieldBuilder<InferFormData<TSchema>, TPath, FormFieldValue<InferFormData<TSchema>, TPath>, Extract<NonNullable<FormFieldValue<InferFormData<TSchema>, TPath>> extends readonly (infer TItem)[] ? TItem : NonNullable<FormFieldValue<InferFormData<TSchema>, TPath>>, OptionValue>, 'toggle-buttons'> {
    return new ChoiceFieldBuilder('toggle-buttons', this.#binding.bind(path))
  }
}

export function choiceFields<TSchema extends FormSchema>(schema: TSchema): ChoiceFieldFactory<TSchema> {
  return new ChoiceFieldFactory(schema)
}
