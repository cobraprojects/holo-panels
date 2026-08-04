import type { FieldDefinition, FormSchema, InferFormData } from '@holo-js/forms'
import type { JsonObject } from '../../protocol/json'
import {
  FieldBuilder,
  FormSchemaBinding,
  type BoundFormField,
  type FormFieldPath,
  type FormFieldPathFor,
  type FormFieldValue,
} from '../base'
import type { BuilderBlockMap, KeyValueEntry } from './types'

type StringValue = string | null | undefined
type ArrayValue = readonly unknown[] | null | undefined

function assertKind(definition: FieldDefinition, kind: FieldDefinition['kind'], type: string): void {
  if (definition.kind !== kind) throw new Error(`${type} fields cannot bind to Holo ${definition.kind} fields`)
}

function stableIdentifier(value: string, label: string): string {
  const normalized = value.trim()
  if (!/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/u.test(normalized)) throw new Error(`${label} requires a stable identifier`)
  return normalized
}

abstract class CollectionFieldBuilder<
  TValues,
  TPath extends FormFieldPath<TValues>,
  TValue extends ArrayValue,
  TType extends string,
  TRecord,
> extends FieldBuilder<TValues, TPath, TValue, TType, TRecord> {
  #minimumItems = 0
  #maximumItems: number | null = null

  minimumItems(value: number): this {
    this.assertMutable()
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('Minimum items must be a non-negative integer')
    this.#minimumItems = value
    return this
  }

  maximumItems(value: number | null): this {
    this.assertMutable()
    if (value !== null && (!Number.isSafeInteger(value) || value < 1)) throw new Error('Maximum items must be a positive integer or null')
    this.#maximumItems = value
    return this
  }

  protected override assertSchemaKind(definition: FieldDefinition): void {
    assertKind(definition, 'array', this.type)
  }

  protected collectionProperties(properties: JsonObject = {}): JsonObject {
    if (this.#maximumItems !== null && this.#minimumItems > this.#maximumItems) throw new Error('Minimum items cannot exceed maximum items')
    return { maximumItems: this.#maximumItems, minimumItems: this.#minimumItems, ...properties }
  }
}

export class TagsFieldBuilder<
  TValues,
  TPath extends FormFieldPath<TValues>,
  TValue extends readonly string[] | null | undefined = FormFieldValue<TValues, TPath> & (readonly string[] | null | undefined),
  TRecord = unknown,
> extends CollectionFieldBuilder<TValues, TPath, TValue, 'tags', TRecord> {
  #separator = ','
  #allowDuplicates = false

  constructor(binding: BoundFormField<TValues, TPath>) {
    super('tags', binding)
  }

  separator(value: string): this {
    this.assertMutable()
    if (value.length < 1 || value.length > 5) throw new Error('Tag separators must contain 1 to 5 characters')
    this.#separator = value
    return this
  }

  allowDuplicates(value = true): this {
    this.assertMutable()
    this.#allowDuplicates = value
    return this
  }

  protected override fieldProperties(): JsonObject {
    return this.collectionProperties({ allowDuplicates: this.#allowDuplicates, separator: this.#separator })
  }
}

export class KeyValueFieldBuilder<
  TValues,
  TPath extends FormFieldPath<TValues>,
  TValue extends readonly KeyValueEntry[] | null | undefined = FormFieldValue<TValues, TPath> & (readonly KeyValueEntry[] | null | undefined),
  TRecord = unknown,
> extends CollectionFieldBuilder<TValues, TPath, TValue, 'key-value', TRecord> {
  #uniqueKeys = true

  constructor(binding: BoundFormField<TValues, TPath>) {
    super('key-value', binding)
  }

  uniqueKeys(value = true): this {
    this.assertMutable()
    this.#uniqueKeys = value
    return this
  }

  protected override fieldProperties(): JsonObject {
    return this.collectionProperties({ uniqueKeys: this.#uniqueKeys })
  }
}

abstract class StringEditorFieldBuilder<
  TValues,
  TPath extends FormFieldPath<TValues>,
  TValue extends StringValue,
  TType extends string,
  TRecord,
> extends FieldBuilder<TValues, TPath, TValue, TType, TRecord> {
  #editorAdapter: string | null = null

  editorAdapter(value: string | null): this {
    this.assertMutable()
    this.#editorAdapter = value === null ? null : stableIdentifier(value, 'Editor adapters')
    return this
  }

  protected override assertSchemaKind(definition: FieldDefinition): void {
    assertKind(definition, 'string', this.type)
  }

  protected editorProperties(properties: JsonObject = {}): JsonObject {
    return { editorAdapter: this.#editorAdapter, ...properties }
  }
}

export class CodeFieldBuilder<
  TValues,
  TPath extends FormFieldPath<TValues>,
  TValue extends StringValue = FormFieldValue<TValues, TPath> & StringValue,
  TRecord = unknown,
> extends StringEditorFieldBuilder<TValues, TPath, TValue, 'code', TRecord> {
  #language = 'text'
  #lineNumbers = true

  constructor(binding: BoundFormField<TValues, TPath>) {
    super('code', binding)
  }

  language(value: string): this {
    this.assertMutable()
    this.#language = stableIdentifier(value, 'Code languages')
    return this
  }

  lineNumbers(value = true): this {
    this.assertMutable()
    this.#lineNumbers = value
    return this
  }

  protected override fieldProperties(): JsonObject {
    return this.editorProperties({ language: this.#language, lineNumbers: this.#lineNumbers })
  }
}

export class MarkdownFieldBuilder<
  TValues,
  TPath extends FormFieldPath<TValues>,
  TValue extends StringValue = FormFieldValue<TValues, TPath> & StringValue,
  TRecord = unknown,
> extends StringEditorFieldBuilder<TValues, TPath, TValue, 'markdown', TRecord> {
  #preview = true

  constructor(binding: BoundFormField<TValues, TPath>) {
    super('markdown', binding)
  }

  preview(value = true): this {
    this.assertMutable()
    this.#preview = value
    return this
  }

  protected override fieldProperties(): JsonObject {
    return this.editorProperties({ preview: this.#preview, rawHtml: false })
  }
}

export class RichEditorFieldBuilder<
  TValues,
  TPath extends FormFieldPath<TValues>,
  TValue extends StringValue = FormFieldValue<TValues, TPath> & StringValue,
  TRecord = unknown,
> extends StringEditorFieldBuilder<TValues, TPath, TValue, 'rich-editor', TRecord> {
  #sanitizer: string | null = null

  constructor(binding: BoundFormField<TValues, TPath>) {
    super('rich-editor', binding)
  }

  sanitizer(value: string): this {
    this.assertMutable()
    this.#sanitizer = stableIdentifier(value, 'Rich text sanitizers')
    return this
  }

  protected override fieldProperties(): JsonObject {
    if (!this.#sanitizer) throw new Error('Rich editor fields require an explicit sanitizer boundary')
    return this.editorProperties({ format: 'structured-json', sanitizer: this.#sanitizer, unsafeRawHtml: false })
  }
}

export class RepeaterFieldBuilder<
  TValues,
  TPath extends FormFieldPath<TValues>,
  TValue extends ArrayValue = FormFieldValue<TValues, TPath> & ArrayValue,
  TRecord = unknown,
> extends CollectionFieldBuilder<TValues, TPath, TValue, 'repeater', TRecord> {
  #collapsible = true
  #cloneable = true
  #reorderable = true

  constructor(binding: BoundFormField<TValues, TPath>) {
    super('repeater', binding)
  }

  collapsible(value = true): this {
    this.assertMutable()
    this.#collapsible = value
    return this
  }

  cloneable(value = true): this {
    this.assertMutable()
    this.#cloneable = value
    return this
  }

  reorderable(value = true): this {
    this.assertMutable()
    this.#reorderable = value
    return this
  }

  protected override fieldProperties(): JsonObject {
    return this.collectionProperties({ collapsible: this.#collapsible, cloneable: this.#cloneable, reorderable: this.#reorderable })
  }
}

export class BuilderFieldBuilder<
  TValues,
  TPath extends FormFieldPath<TValues>,
  TValue extends ArrayValue,
  TBlocks extends BuilderBlockMap,
  TRecord = unknown,
> extends CollectionFieldBuilder<TValues, TPath, TValue, 'builder', TRecord> {
  readonly #blocks: TBlocks

  constructor(binding: BoundFormField<TValues, TPath>, blocks: TBlocks) {
    super('builder', binding)
    this.#blocks = blocks
  }

  protected override fieldProperties(): JsonObject {
    const blocks = Object.entries(this.#blocks).map(([type, definition]) => {
      if (type !== definition.type) throw new Error(`Builder block key ${type} must match its type`)
      return {
        icon: definition.icon ?? null,
        label: definition.label,
        type: stableIdentifier(type, 'Builder block types'),
      }
    })
    if (blocks.length === 0) throw new Error('Builder fields require at least one block schema')
    return this.collectionProperties({ blocks })
  }
}

export class CollectionFieldFactory<TSchema extends FormSchema> {
  readonly #binding: FormSchemaBinding<TSchema>

  constructor(schema: TSchema) {
    this.#binding = new FormSchemaBinding(schema)
  }

  tags<TPath extends FormFieldPathFor<InferFormData<TSchema>, readonly string[]>>(path: TPath): TagsFieldBuilder<InferFormData<TSchema>, TPath, Extract<FormFieldValue<InferFormData<TSchema>, TPath>, readonly string[] | null | undefined>> {
    return new TagsFieldBuilder(this.#binding.bind(path))
  }

  keyValue<TPath extends FormFieldPathFor<InferFormData<TSchema>, readonly KeyValueEntry[]>>(path: TPath): KeyValueFieldBuilder<InferFormData<TSchema>, TPath, Extract<FormFieldValue<InferFormData<TSchema>, TPath>, readonly KeyValueEntry[] | null | undefined>> {
    return new KeyValueFieldBuilder(this.#binding.bind(path))
  }

  code<TPath extends FormFieldPathFor<InferFormData<TSchema>, string>>(path: TPath): CodeFieldBuilder<InferFormData<TSchema>, TPath, Extract<FormFieldValue<InferFormData<TSchema>, TPath>, StringValue>> {
    return new CodeFieldBuilder(this.#binding.bind(path))
  }

  markdown<TPath extends FormFieldPathFor<InferFormData<TSchema>, string>>(path: TPath): MarkdownFieldBuilder<InferFormData<TSchema>, TPath, Extract<FormFieldValue<InferFormData<TSchema>, TPath>, StringValue>> {
    return new MarkdownFieldBuilder(this.#binding.bind(path))
  }

  richEditor<TPath extends FormFieldPathFor<InferFormData<TSchema>, string>>(path: TPath): RichEditorFieldBuilder<InferFormData<TSchema>, TPath, Extract<FormFieldValue<InferFormData<TSchema>, TPath>, StringValue>> {
    return new RichEditorFieldBuilder(this.#binding.bind(path))
  }

  repeater<TPath extends FormFieldPathFor<InferFormData<TSchema>, readonly object[]>>(path: TPath): RepeaterFieldBuilder<InferFormData<TSchema>, TPath, Extract<FormFieldValue<InferFormData<TSchema>, TPath>, ArrayValue>> {
    return new RepeaterFieldBuilder(this.#binding.bind(path))
  }

  builder<
    TPath extends FormFieldPathFor<InferFormData<TSchema>, readonly object[]>,
    TBlocks extends BuilderBlockMap,
  >(path: TPath, blocks: TBlocks): BuilderFieldBuilder<InferFormData<TSchema>, TPath, Extract<FormFieldValue<InferFormData<TSchema>, TPath>, ArrayValue>, TBlocks> {
    return new BuilderFieldBuilder(this.#binding.bind(path), blocks)
  }
}

export function collectionFields<TSchema extends FormSchema>(schema: TSchema): CollectionFieldFactory<TSchema> {
  return new CollectionFieldFactory(schema)
}
