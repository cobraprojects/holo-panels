import {
  BuilderFieldBuilder,
  CheckboxFieldBuilder,
  ChoiceFieldBuilder,
  CodeFieldBuilder,
  ColorFieldBuilder,
  customField,
  DateFieldBuilder,
  HiddenFieldBuilder,
  KeyValueFieldBuilder,
  MarkdownFieldBuilder,
  RadioFieldBuilder,
  RepeaterFieldBuilder,
  RichEditorFieldBuilder,
  SliderFieldBuilder,
  SlugFieldBuilder,
  TagsFieldBuilder,
  TextareaFieldBuilder,
  TextFieldBuilder,
  ToggleFieldBuilder,
  UploadFieldBuilder,
  columnsFor,
  type BoundFormField,
  type BuilderBlockMap,
  type ColumnFactory,
  type CustomFieldBuilder,
  type CustomFieldDefinition,
  type ExtensionTypeId,
  type FormFieldPath,
  type FormFieldPathFor,
  type FormFieldValue,
  type JsonObject,
  type KeyValueEntry,
  type OptionValue,
  type ResourceAttributes,
  type UploadPolicy,
} from '@holo-js/panels-core'

type ModelSource = {
  readonly definition?: {
    readonly relations?: Readonly<Record<string, unknown>>
    readonly table?: {
      readonly columns?: Readonly<Record<string, { readonly kind?: string }>>
    }
  }
  create(...parameters: never[]): object | Promise<object>
}

type ModelRecord<TSource extends ModelSource> = Awaited<ReturnType<TSource['create']>>
type PreviousDepth = [never, 0, 1, 2, 3, 4]

type RelatedSource<TRelation> = TRelation extends { readonly related: () => infer TSource extends ModelSource }
  ? TSource
  : never

type RelatedRecord<TRelation, TDepth extends number> = RelatedSource<TRelation> extends infer TSource extends ModelSource
  ? ModelRecord<TSource> & ModelRelationValues<TSource, TDepth>
  : never

type RelatedValue<TRelation, TDepth extends number> = TRelation extends { readonly kind: 'belongsToMany' | 'hasMany' | 'hasManyThrough' | 'morphMany' | 'morphToMany' | 'morphedByMany' }
  ? readonly RelatedRecord<TRelation, TDepth>[]
  : TRelation extends { readonly kind: 'morphTo' }
    ? object | null
    : RelatedRecord<TRelation, TDepth> | null

type ModelRelationValues<TSource extends ModelSource, TDepth extends number = 3> = TDepth extends 0
  ? object
  : TSource extends { readonly definition: { readonly relations: infer TRelations extends Readonly<Record<string, unknown>> } }
    ? string extends keyof TRelations
      ? object
      : { readonly [TName in keyof TRelations & string]: RelatedValue<TRelations[TName], PreviousDepth[TDepth]> }
    : object

export type ModelRecordWithRelations<TSource extends ModelSource> = ModelRecord<TSource> & ModelRelationValues<TSource>

type ValuesFor<TRecord> = ResourceAttributes<TRecord>
type TextValue = string | number | null | undefined
type StringValue = string | null | undefined
type BooleanValue = boolean | null | undefined
type DateValue = Date | null | undefined
type ArrayValue = readonly unknown[] | null | undefined

function modelFieldKind(source: ModelSource, path: string, fallback: BoundFormField<object, never>['schema']['kind']): BoundFormField<object, never>['schema']['kind'] {
  const column = source.definition?.table?.columns?.[path.split('.')[0] ?? '']
  if (!column?.kind) return fallback
  if (column.kind === 'boolean') return 'boolean'
  if (['date', 'datetime', 'timestamp'].includes(column.kind)) return 'date'
  if (['bigInteger', 'decimal', 'id', 'integer', 'real', 'snowflake'].includes(column.kind)) return 'number'
  if (['json', 'vector'].includes(column.kind)) return 'array'
  return 'string'
}

function modelBinding<TValues, TPath extends FormFieldPath<TValues>>(
  source: ModelSource,
  path: TPath,
  fallback: BoundFormField<TValues, TPath>['schema']['kind'],
): BoundFormField<TValues, TPath> {
  return Object.freeze({
    path,
    schema: Object.freeze({ kind: modelFieldKind(source, path, fallback), rules: Object.freeze([]) }),
  })
}

function modelUploadBinding<TValues, TPath extends FormFieldPath<TValues>>(
  source: ModelSource,
  path: TPath,
): BoundFormField<TValues, TPath> {
  const binding = modelBinding<TValues, TPath>(source, path, 'file')
  return Object.freeze({
    ...binding,
    schema: Object.freeze({ ...binding.schema, kind: 'file' }),
  })
}

export class ModelFieldFactory<TRecord> {
  readonly #source: ModelSource

  constructor(source: ModelSource) {
    this.#source = source
  }
  text<TPath extends FormFieldPathFor<ValuesFor<TRecord>, string | number>>(path: TPath): TextFieldBuilder<ValuesFor<TRecord>, TPath, FormFieldValue<ValuesFor<TRecord>, TPath> & TextValue, TRecord> {
    return new TextFieldBuilder(modelBinding(this.#source, path, typeof path === 'number' ? 'number' : 'string'))
  }

  textarea<TPath extends FormFieldPathFor<ValuesFor<TRecord>, string>>(path: TPath): TextareaFieldBuilder<ValuesFor<TRecord>, TPath, FormFieldValue<ValuesFor<TRecord>, TPath> & StringValue, TRecord> {
    return new TextareaFieldBuilder(modelBinding(this.#source, path, 'string'))
  }

  checkbox<TPath extends FormFieldPathFor<ValuesFor<TRecord>, boolean>>(path: TPath): CheckboxFieldBuilder<ValuesFor<TRecord>, TPath, FormFieldValue<ValuesFor<TRecord>, TPath> & BooleanValue, TRecord> {
    return new CheckboxFieldBuilder(modelBinding(this.#source, path, 'boolean'))
  }

  toggle<TPath extends FormFieldPathFor<ValuesFor<TRecord>, boolean>>(path: TPath): ToggleFieldBuilder<ValuesFor<TRecord>, TPath, FormFieldValue<ValuesFor<TRecord>, TPath> & BooleanValue, TRecord> {
    return new ToggleFieldBuilder(modelBinding(this.#source, path, 'boolean'))
  }

  radio<TPath extends FormFieldPathFor<ValuesFor<TRecord>, boolean | number | string>>(path: TPath): RadioFieldBuilder<ValuesFor<TRecord>, TPath, FormFieldValue<ValuesFor<TRecord>, TPath> & (boolean | number | string | null | undefined), TRecord> {
    return new RadioFieldBuilder(modelBinding(this.#source, path, 'string'))
  }

  date<TPath extends FormFieldPathFor<ValuesFor<TRecord>, Date>>(path: TPath): DateFieldBuilder<ValuesFor<TRecord>, TPath, FormFieldValue<ValuesFor<TRecord>, TPath> & DateValue, TRecord> {
    return new DateFieldBuilder(modelBinding(this.#source, path, 'date'), 'date')
  }

  time<TPath extends FormFieldPathFor<ValuesFor<TRecord>, Date>>(path: TPath): DateFieldBuilder<ValuesFor<TRecord>, TPath, FormFieldValue<ValuesFor<TRecord>, TPath> & DateValue, TRecord> {
    return new DateFieldBuilder(modelBinding(this.#source, path, 'date'), 'time')
  }

  dateTime<TPath extends FormFieldPathFor<ValuesFor<TRecord>, Date>>(path: TPath): DateFieldBuilder<ValuesFor<TRecord>, TPath, FormFieldValue<ValuesFor<TRecord>, TPath> & DateValue, TRecord> {
    return new DateFieldBuilder(modelBinding(this.#source, path, 'date'), 'date-time')
  }

  hidden<TPath extends FormFieldPath<ValuesFor<TRecord>>>(path: TPath): HiddenFieldBuilder<ValuesFor<TRecord>, TPath, FormFieldValue<ValuesFor<TRecord>, TPath>, TRecord> {
    return new HiddenFieldBuilder(modelBinding(this.#source, path, 'string'))
  }

  slider<TPath extends FormFieldPathFor<ValuesFor<TRecord>, number>>(path: TPath): SliderFieldBuilder<ValuesFor<TRecord>, TPath, FormFieldValue<ValuesFor<TRecord>, TPath> & (number | null | undefined), TRecord> {
    return new SliderFieldBuilder(modelBinding(this.#source, path, 'number'))
  }

  color<TPath extends FormFieldPathFor<ValuesFor<TRecord>, string>>(path: TPath): ColorFieldBuilder<ValuesFor<TRecord>, TPath, FormFieldValue<ValuesFor<TRecord>, TPath> & StringValue, TRecord> {
    return new ColorFieldBuilder(modelBinding(this.#source, path, 'string'))
  }

  slug<TPath extends FormFieldPathFor<ValuesFor<TRecord>, string>>(path: TPath): SlugFieldBuilder<ValuesFor<TRecord>, TPath, FormFieldValue<ValuesFor<TRecord>, TPath> & StringValue, TRecord> {
    return new SlugFieldBuilder(modelBinding(this.#source, path, 'string'))
  }

  select<TPath extends FormFieldPathFor<ValuesFor<TRecord>, OptionValue>>(path: TPath): ChoiceFieldBuilder<ValuesFor<TRecord>, TPath, FormFieldValue<ValuesFor<TRecord>, TPath>, Extract<NonNullable<FormFieldValue<ValuesFor<TRecord>, TPath>>, OptionValue>, 'select', TRecord> {
    return new ChoiceFieldBuilder<ValuesFor<TRecord>, TPath, FormFieldValue<ValuesFor<TRecord>, TPath>, Extract<NonNullable<FormFieldValue<ValuesFor<TRecord>, TPath>>, OptionValue>, 'select', TRecord>('select', modelBinding(this.#source, path, 'string'))
  }

  multiselect<TPath extends FormFieldPathFor<ValuesFor<TRecord>, readonly OptionValue[]>>(path: TPath): ChoiceFieldBuilder<ValuesFor<TRecord>, TPath, FormFieldValue<ValuesFor<TRecord>, TPath>, Extract<NonNullable<FormFieldValue<ValuesFor<TRecord>, TPath>> extends readonly (infer TItem)[] ? TItem : never, OptionValue>, 'multiselect', TRecord> {
    return new ChoiceFieldBuilder<ValuesFor<TRecord>, TPath, FormFieldValue<ValuesFor<TRecord>, TPath>, Extract<NonNullable<FormFieldValue<ValuesFor<TRecord>, TPath>> extends readonly (infer TItem)[] ? TItem : never, OptionValue>, 'multiselect', TRecord>('multiselect', modelBinding(this.#source, path, 'array'))
  }

  checkboxList<TPath extends FormFieldPathFor<ValuesFor<TRecord>, readonly OptionValue[]>>(path: TPath): ChoiceFieldBuilder<ValuesFor<TRecord>, TPath, FormFieldValue<ValuesFor<TRecord>, TPath>, Extract<NonNullable<FormFieldValue<ValuesFor<TRecord>, TPath>> extends readonly (infer TItem)[] ? TItem : never, OptionValue>, 'checkbox-list', TRecord> {
    return new ChoiceFieldBuilder<ValuesFor<TRecord>, TPath, FormFieldValue<ValuesFor<TRecord>, TPath>, Extract<NonNullable<FormFieldValue<ValuesFor<TRecord>, TPath>> extends readonly (infer TItem)[] ? TItem : never, OptionValue>, 'checkbox-list', TRecord>('checkbox-list', modelBinding(this.#source, path, 'array'))
  }

  toggleButtons<TPath extends FormFieldPathFor<ValuesFor<TRecord>, OptionValue | readonly OptionValue[]>>(path: TPath): ChoiceFieldBuilder<ValuesFor<TRecord>, TPath, FormFieldValue<ValuesFor<TRecord>, TPath>, Extract<NonNullable<FormFieldValue<ValuesFor<TRecord>, TPath>> extends readonly (infer TItem)[] ? TItem : NonNullable<FormFieldValue<ValuesFor<TRecord>, TPath>>, OptionValue>, 'toggle-buttons', TRecord> {
    return new ChoiceFieldBuilder<ValuesFor<TRecord>, TPath, FormFieldValue<ValuesFor<TRecord>, TPath>, Extract<NonNullable<FormFieldValue<ValuesFor<TRecord>, TPath>> extends readonly (infer TItem)[] ? TItem : NonNullable<FormFieldValue<ValuesFor<TRecord>, TPath>>, OptionValue>, 'toggle-buttons', TRecord>('toggle-buttons', modelBinding(this.#source, path, 'string'))
  }

  tags<TPath extends FormFieldPathFor<ValuesFor<TRecord>, readonly string[]>>(path: TPath): TagsFieldBuilder<ValuesFor<TRecord>, TPath, FormFieldValue<ValuesFor<TRecord>, TPath> & (readonly string[] | null | undefined), TRecord> {
    return new TagsFieldBuilder(modelBinding(this.#source, path, 'array'))
  }

  keyValue<TPath extends FormFieldPathFor<ValuesFor<TRecord>, readonly KeyValueEntry[]>>(path: TPath): KeyValueFieldBuilder<ValuesFor<TRecord>, TPath, FormFieldValue<ValuesFor<TRecord>, TPath> & (readonly KeyValueEntry[] | null | undefined), TRecord> {
    return new KeyValueFieldBuilder(modelBinding(this.#source, path, 'array'))
  }

  code<TPath extends FormFieldPathFor<ValuesFor<TRecord>, string>>(path: TPath): CodeFieldBuilder<ValuesFor<TRecord>, TPath, FormFieldValue<ValuesFor<TRecord>, TPath> & StringValue, TRecord> {
    return new CodeFieldBuilder(modelBinding(this.#source, path, 'string'))
  }

  markdown<TPath extends FormFieldPathFor<ValuesFor<TRecord>, string>>(path: TPath): MarkdownFieldBuilder<ValuesFor<TRecord>, TPath, FormFieldValue<ValuesFor<TRecord>, TPath> & StringValue, TRecord> {
    return new MarkdownFieldBuilder(modelBinding(this.#source, path, 'string'))
  }

  richEditor<TPath extends FormFieldPathFor<ValuesFor<TRecord>, string>>(path: TPath): RichEditorFieldBuilder<ValuesFor<TRecord>, TPath, FormFieldValue<ValuesFor<TRecord>, TPath> & StringValue, TRecord> {
    return new RichEditorFieldBuilder(modelBinding(this.#source, path, 'string'))
  }

  repeater<TPath extends FormFieldPathFor<ValuesFor<TRecord>, readonly object[]>>(path: TPath): RepeaterFieldBuilder<ValuesFor<TRecord>, TPath, FormFieldValue<ValuesFor<TRecord>, TPath> & ArrayValue, TRecord> {
    return new RepeaterFieldBuilder(modelBinding(this.#source, path, 'array'))
  }

  builder<TPath extends FormFieldPathFor<ValuesFor<TRecord>, readonly object[]>, TBlocks extends BuilderBlockMap>(path: TPath, blocks: TBlocks): BuilderFieldBuilder<ValuesFor<TRecord>, TPath, FormFieldValue<ValuesFor<TRecord>, TPath> & ArrayValue, TBlocks, TRecord> {
    return new BuilderFieldBuilder(modelBinding(this.#source, path, 'array'), blocks)
  }

  file<TPath extends FormFieldPathFor<ValuesFor<TRecord>, string | readonly string[]>>(path: TPath, policy: UploadPolicy): UploadFieldBuilder<ValuesFor<TRecord>, TPath, TRecord> {
    return new UploadFieldBuilder(modelUploadBinding(this.#source, path), policy)
  }

  custom<TPath extends FormFieldPath<ValuesFor<TRecord>>, TValue, TType extends ExtensionTypeId<'field'>, TProperties extends JsonObject, TContext>(path: TPath, typeId: TType, definition: CustomFieldDefinition<TValue, TProperties, TContext>): CustomFieldBuilder<ValuesFor<TRecord>, TPath, TValue, TType, TProperties, TRecord> {
    return customField(modelBinding(this.#source, path, 'string'), typeId, definition) as CustomFieldBuilder<ValuesFor<TRecord>, TPath, TValue, TType, TProperties, TRecord>
  }
}

export function modelColumns<TSource extends ModelSource>(source: TSource): ColumnFactory<ModelRecordWithRelations<TSource>> {
  return columnsFor(source) as unknown as ColumnFactory<ModelRecordWithRelations<TSource>>
}

export type ModelComponentSource = ModelSource
