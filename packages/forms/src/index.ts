import { type JsonObject, type JsonValue, toJsonValue } from '@holo-js/panels-core'
import { Component, compileSchemaComponentManifest, type SchemaComponentManifest } from '@holo-js/panels-schemas'

export type FieldPath<TRecord extends object> = Extract<keyof TRecord, string>
export type FieldValue<TRecord extends object, TPath extends FieldPath<TRecord>> = TRecord[TPath]
export type FieldPathFor<TRecord extends object, TValue> = Extract<
  string extends keyof TRecord
    ? string
    : { readonly [TPath in FieldPath<TRecord>]: NonNullable<TRecord[TPath]> extends TValue ? TPath : never }[FieldPath<TRecord>],
  FieldPath<TRecord>
>
export type FieldState<TValue> = TValue | null | undefined
export type FieldOptions<TValue extends boolean | number | string> = Readonly<Record<string, string>> | readonly Readonly<{ readonly disabled?: boolean, readonly label: string, readonly value: TValue }>[]
export type FieldResolver<TRecord extends object, TValue> = TValue | ((context: FieldContext<TRecord>) => TValue | Promise<TValue>)

export interface FieldContext<TRecord extends object> {
  readonly operation: string
  readonly record: TRecord | null
  readonly get: <TPath extends FieldPath<TRecord>>(path: TPath) => TRecord[TPath] | undefined
  readonly set: <TPath extends FieldPath<TRecord>>(path: TPath, value: TRecord[TPath]) => void
}

function json(value: unknown): JsonValue {
  return toJsonValue(value)
}

function staticValue(value: unknown): JsonValue {
  return typeof value === 'function' || typeof value === 'undefined' ? null : json(value)
}

export abstract class Field<
  TRecord extends object = Record<string, unknown>,
  TPath extends FieldPath<TRecord> = FieldPath<TRecord>,
  TValue = FieldValue<TRecord, TPath>,
> extends Component<TRecord> {
  declare readonly fieldValueType: TValue
  readonly path: TPath
  readonly type: string
  #afterStateHydrated: ((state: FieldState<TValue>, context: FieldContext<TRecord>) => void | Promise<void>) | null = null
  #afterStateUpdated: ((state: FieldState<TValue>, previous: FieldState<TValue>, context: FieldContext<TRecord>) => void | Promise<void>) | null = null
  #autocomplete: string | null = null
  #debounceMilliseconds = 0
  #defaultValue: FieldResolver<TRecord, FieldState<TValue>> = undefined
  #dehydrated = true
  #disabled: FieldResolver<TRecord, boolean> = false
  #extraInputAttributes: JsonObject = {}
  #helperText: FieldResolver<TRecord, string | null> = null
  #hint: FieldResolver<TRecord, string | null> = null
  #hintIcon: string | null = null
  #label: FieldResolver<TRecord, string | null> = null
  #placeholder: FieldResolver<TRecord, string | null> = null
  #readOnly: FieldResolver<TRecord, boolean> = false
  #required = false
  #rules: readonly string[] = []

  protected constructor(type: string, path: TPath) {
    super('field', path)
    this.type = type
    this.path = path
  }

  afterStateHydrated(callback: (state: FieldState<TValue>, context: FieldContext<TRecord>) => void | Promise<void>): this {
    this.#afterStateHydrated = callback
    return this
  }

  afterStateUpdated(callback: (state: FieldState<TValue>, previous: FieldState<TValue>, context: FieldContext<TRecord>) => void | Promise<void>): this {
    this.#afterStateUpdated = callback
    return this
  }

  autocomplete(value: string | null): this {
    this.#autocomplete = value
    return this
  }

  default(value: FieldResolver<TRecord, FieldState<TValue>>): this {
    this.#defaultValue = value
    return this
  }

  debounce(milliseconds: number | string = 500): this {
    this.#debounceMilliseconds = typeof milliseconds === 'number' ? milliseconds : Number.parseInt(milliseconds, 10)
    return this
  }

  live(onBlur = false, debounce: number | string | null = null): this {
    this.#debounceMilliseconds = onBlur ? -1 : debounce === null ? 0 : typeof debounce === 'number' ? debounce : Number.parseInt(debounce, 10)
    return this
  }

  lazy(value = true): this {
    this.#debounceMilliseconds = value ? -1 : 0
    return this
  }

  reactive(value = true): this {
    this.#debounceMilliseconds = value ? 0 : this.#debounceMilliseconds
    return this
  }

  dehydrated(value = true): this {
    this.#dehydrated = value
    return this
  }

  disabled(value: FieldResolver<TRecord, boolean> = true): this {
    this.#disabled = value
    return this
  }

  extraInputAttributes(attributes: Readonly<Record<string, unknown>>): this {
    const normalized = json(attributes)
    if (typeof normalized !== 'object' || normalized === null || Array.isArray(normalized)) throw new Error('Input attributes must be a JSON-safe object')
    this.#extraInputAttributes = normalized
    return this
  }

  helperText(value: FieldResolver<TRecord, string | null>): this {
    this.#helperText = value
    return this
  }

  hint(value: FieldResolver<TRecord, string | null>): this {
    this.#hint = value
    return this
  }

  hintIcon(value: string | null): this {
    this.#hintIcon = value
    return this
  }

  label(value: FieldResolver<TRecord, string | null>): this {
    this.#label = value
    return this
  }

  placeholder(value: FieldResolver<TRecord, string | null>): this {
    this.#placeholder = value
    return this
  }

  readOnly(value: FieldResolver<TRecord, boolean> = true): this {
    this.#readOnly = value
    return this
  }

  required(value = true): this {
    this.#required = value
    return this
  }

  rule(rule: string): this {
    this.#rules = Object.freeze([...this.#rules, rule])
    return this
  }

  rules(rules: readonly string[]): this {
    this.#rules = Object.freeze([...rules])
    return this
  }

  unique(table?: string, column?: string, ignoreRecord = false): this {
    return this.rule(`unique:${table ?? ''},${column ?? this.path},${ignoreRecord ? 'ignore-record' : ''}`)
  }

  exists(table?: string, column?: string): this {
    return this.rule(`exists:${table ?? ''},${column ?? this.path}`)
  }

  minValue(value: number): this {
    return this.rule(`min-value:${value}`)
  }

  maxValue(value: number): this {
    return this.rule(`max-value:${value}`)
  }

  minLength(value: number): this {
    return this.rule(`min-length:${value}`)
  }

  maxLength(value: number): this {
    return this.rule(`max-length:${value}`)
  }

  length(value: number): this {
    return this.rule(`length:${value}`)
  }

  regex(value: RegExp | string): this {
    return this.rule(`regex:${String(value)}`)
  }

  protected override componentProperties(): JsonObject {
    return {
      afterStateHydrated: this.#afterStateHydrated ? true : false,
      afterStateUpdated: this.#afterStateUpdated ? true : false,
      autocomplete: this.#autocomplete,
      debounceMilliseconds: this.#debounceMilliseconds,
      defaultValue: staticValue(this.#defaultValue),
      dehydrated: this.#dehydrated,
      disabled: staticValue(this.#disabled),
      extraInputAttributes: this.#extraInputAttributes,
      helperText: staticValue(this.#helperText),
      hint: staticValue(this.#hint),
      hintIcon: this.#hintIcon,
      kind: 'field',
      label: staticValue(this.#label),
      path: this.path,
      placeholder: staticValue(this.#placeholder),
      properties: this.fieldProperties(),
      readOnly: staticValue(this.#readOnly),
      required: this.#required,
      rules: [...this.#rules],
      type: this.type,
    }
  }

  protected fieldProperties(): JsonObject {
    return {}
  }
}

export class TextInput<TRecord extends object = Record<string, unknown>, TPath extends FieldPathFor<TRecord, number | string> = FieldPathFor<TRecord, number | string>> extends Field<TRecord, TPath> {
  #datalist: readonly string[] = []
  #inputMode = 'text'
  #mask: string | null = null
  #prefix: string | null = null
  #revealable = false
  #suffix: string | null = null

  private constructor(path: TPath) {
    super('text', path)
  }

  static make<TRecord extends object = Record<string, unknown>, TPath extends FieldPathFor<TRecord, number | string> = FieldPathFor<TRecord, number | string>>(path: TPath): TextInput<TRecord, TPath> {
    return new TextInput(path)
  }

  email(value = true): this {
    this.#inputMode = value ? 'email' : 'text'
    return this
  }

  numeric(value = true): this {
    this.#inputMode = value ? 'numeric' : 'text'
    return this
  }

  password(value = true): this {
    this.#inputMode = value ? 'password' : 'text'
    return this
  }

  revealable(value = true): this {
    this.#revealable = value
    return this
  }

  tel(value = true): this {
    this.#inputMode = value ? 'tel' : 'text'
    return this
  }

  url(value = true): this {
    this.#inputMode = value ? 'url' : 'text'
    return this
  }

  prefix(value: string | null): this {
    this.#prefix = value
    return this
  }

  suffix(value: string | null): this {
    this.#suffix = value
    return this
  }

  mask(value: string | null): this {
    this.#mask = value
    return this
  }

  datalist(values: readonly string[]): this {
    this.#datalist = Object.freeze([...values])
    return this
  }

  protected override fieldProperties(): JsonObject {
    return { datalist: [...this.#datalist], inputMode: this.#inputMode, mask: this.#mask, prefix: this.#prefix, revealable: this.#revealable, suffix: this.#suffix }
  }
}

export class Textarea<TRecord extends object = Record<string, unknown>, TPath extends FieldPathFor<TRecord, string> = FieldPathFor<TRecord, string>> extends Field<TRecord, TPath> {
  #autosize = false
  #rows = 4

  private constructor(path: TPath) {
    super('textarea', path)
  }

  static make<TRecord extends object = Record<string, unknown>, TPath extends FieldPathFor<TRecord, string> = FieldPathFor<TRecord, string>>(path: TPath): Textarea<TRecord, TPath> {
    return new Textarea(path)
  }

  autosize(value = true): this {
    this.#autosize = value
    return this
  }

  rows(value: number): this {
    this.#rows = value
    return this
  }

  protected override fieldProperties(): JsonObject {
    return { autosize: this.#autosize, rows: this.#rows }
  }
}

abstract class BooleanField<TRecord extends object, TPath extends FieldPathFor<TRecord, boolean>> extends Field<TRecord, TPath> {
  #offColor: string | null = null
  #offIcon: string | null = null
  #onColor: string | null = null
  #onIcon: string | null = null

  offColor(value: string | null): this { this.#offColor = value; return this }
  offIcon(value: string | null): this { this.#offIcon = value; return this }
  onColor(value: string | null): this { this.#onColor = value; return this }
  onIcon(value: string | null): this { this.#onIcon = value; return this }

  protected override fieldProperties(): JsonObject {
    return { offColor: this.#offColor, offIcon: this.#offIcon, onColor: this.#onColor, onIcon: this.#onIcon }
  }
}

export class Checkbox<TRecord extends object = Record<string, unknown>, TPath extends FieldPathFor<TRecord, boolean> = FieldPathFor<TRecord, boolean>> extends BooleanField<TRecord, TPath> {
  private constructor(path: TPath) { super('checkbox', path) }
  static make<TRecord extends object = Record<string, unknown>, TPath extends FieldPathFor<TRecord, boolean> = FieldPathFor<TRecord, boolean>>(path: TPath): Checkbox<TRecord, TPath> { return new Checkbox(path) }
}

export class Toggle<TRecord extends object = Record<string, unknown>, TPath extends FieldPathFor<TRecord, boolean> = FieldPathFor<TRecord, boolean>> extends BooleanField<TRecord, TPath> {
  private constructor(path: TPath) { super('toggle', path) }
  static make<TRecord extends object = Record<string, unknown>, TPath extends FieldPathFor<TRecord, boolean> = FieldPathFor<TRecord, boolean>>(path: TPath): Toggle<TRecord, TPath> { return new Toggle(path) }
}

type ChoiceValue = boolean | number | string

interface ChoiceOption<TValue extends ChoiceValue> {
  readonly disabled?: boolean
  readonly label: string
  readonly value: TValue
}

interface ChoiceOptionRequest {
  readonly locale: string
  readonly page: number
  readonly perPage: number
  readonly search: string
}

function choiceOptions<TValue extends ChoiceValue>(options: FieldOptions<TValue>): readonly ChoiceOption<TValue>[] {
  if (Array.isArray(options)) return Object.freeze(options.map(option => Object.freeze({ ...option })))
  return Object.freeze(Object.entries(options).map(([value, label]) => Object.freeze({ label, value: value as TValue })))
}

class FieldOptionSource<TRecord extends object> {
  readonly kind = 'field'

  constructor(readonly options: FieldResolver<TRecord, FieldOptions<ChoiceValue>>) {}

  manifestOptions(): readonly ChoiceOption<ChoiceValue>[] {
    return typeof this.options === 'function' ? Object.freeze([]) : choiceOptions(this.options)
  }

  async list(request: ChoiceOptionRequest, context: FieldContext<TRecord>): Promise<Readonly<{
    readonly hasMore: boolean
    readonly options: readonly ChoiceOption<ChoiceValue>[]
    readonly page: number
    readonly perPage: number
    readonly total: number
  }>> {
    const options = await this.resolve(context)
    const search = request.search.trim().toLocaleLowerCase(request.locale)
    const matching = search.length > 0
      ? options.filter(option => option.label.toLocaleLowerCase(request.locale).includes(search))
      : options
    const offset = (request.page - 1) * request.perPage
    return Object.freeze({
      hasMore: offset + request.perPage < matching.length,
      options: Object.freeze(matching.slice(offset, offset + request.perPage)),
      page: request.page,
      perPage: request.perPage,
      total: matching.length,
    })
  }

  async hydrateSelected(
    _request: ChoiceOptionRequest,
    selectedValues: readonly ChoiceValue[],
    context: FieldContext<TRecord>,
  ): Promise<readonly ChoiceOption<ChoiceValue>[]> {
    const selected = new Set(selectedValues)
    return Object.freeze((await this.resolve(context)).filter(option => selected.has(option.value)))
  }

  private async resolve(context: FieldContext<TRecord>): Promise<readonly ChoiceOption<ChoiceValue>[]> {
    const options = typeof this.options === 'function' ? await this.options(context) : this.options
    return choiceOptions(options)
  }
}

abstract class ChoiceField<TRecord extends object, TPath extends FieldPath<TRecord>> extends Field<TRecord, TPath> {
  #allowHtml = false
  #multiple = false
  #options: FieldResolver<TRecord, FieldOptions<ChoiceValue>> = {}
  #preload = false
  #relationship: Readonly<{ name: string, titleAttribute: string }> | null = null
  #searchable = false

  allowHtml(value = true): this { this.#allowHtml = value; return this }
  multiple(value = true): this { this.#multiple = value; return this }
  options(value: FieldResolver<TRecord, FieldOptions<ChoiceValue>>): this { this.#options = value; return this }
  preload(value = true): this { this.#preload = value; return this }
  relationship(name: string, titleAttribute: string): this { this.#relationship = Object.freeze({ name, titleAttribute }); return this }
  searchable(value = true): this { this.#searchable = value; return this }

  override compile(): SchemaComponentManifest & Readonly<{ server: Readonly<{ options: FieldOptionSource<TRecord> }> }> {
    return Object.freeze({
      ...super.compile(),
      server: Object.freeze({ options: new FieldOptionSource(this.#options) }),
    })
  }

  protected override fieldProperties(): JsonObject {
    return { allowHtml: this.#allowHtml, multiple: this.#multiple, options: staticValue(this.#options), preload: this.#preload, relationship: this.#relationship, searchable: this.#searchable }
  }
}

export class Select<TRecord extends object = Record<string, unknown>, TPath extends FieldPath<TRecord> = FieldPath<TRecord>> extends ChoiceField<TRecord, TPath> {
  private constructor(path: TPath) { super('select', path) }
  static make<TRecord extends object = Record<string, unknown>, TPath extends FieldPath<TRecord> = FieldPath<TRecord>>(path: TPath): Select<TRecord, TPath> { return new Select(path) }
}

export class CheckboxList<TRecord extends object = Record<string, unknown>, TPath extends FieldPath<TRecord> = FieldPath<TRecord>> extends ChoiceField<TRecord, TPath> {
  #bulkToggleable = false
  #columns = 1
  #gridDirection: 'column' | 'row' = 'column'
  private constructor(path: TPath) { super('checkbox-list', path) }
  static make<TRecord extends object = Record<string, unknown>, TPath extends FieldPath<TRecord> = FieldPath<TRecord>>(path: TPath): CheckboxList<TRecord, TPath> { return new CheckboxList(path) }
  bulkToggleable(value = true): this { this.#bulkToggleable = value; return this }
  columns(value: number): this { this.#columns = value; return this }
  gridDirection(value: 'column' | 'row'): this { this.#gridDirection = value; return this }
  protected override fieldProperties(): JsonObject { return { ...super.fieldProperties(), bulkToggleable: this.#bulkToggleable, columns: this.#columns, gridDirection: this.#gridDirection } }
}

export class Radio<TRecord extends object = Record<string, unknown>, TPath extends FieldPath<TRecord> = FieldPath<TRecord>> extends ChoiceField<TRecord, TPath> {
  #inline = false
  private constructor(path: TPath) { super('radio', path) }
  static make<TRecord extends object = Record<string, unknown>, TPath extends FieldPath<TRecord> = FieldPath<TRecord>>(path: TPath): Radio<TRecord, TPath> { return new Radio(path) }
  inline(value = true): this { this.#inline = value; return this }
  protected override fieldProperties(): JsonObject { return { ...super.fieldProperties(), inline: this.#inline } }
}

export class ToggleButtons<TRecord extends object = Record<string, unknown>, TPath extends FieldPath<TRecord> = FieldPath<TRecord>> extends ChoiceField<TRecord, TPath> {
  #grouped = false
  #icons: Readonly<Record<string, string>> = {}
  #inline = false
  private constructor(path: TPath) { super('toggle-buttons', path) }
  static make<TRecord extends object = Record<string, unknown>, TPath extends FieldPath<TRecord> = FieldPath<TRecord>>(path: TPath): ToggleButtons<TRecord, TPath> { return new ToggleButtons(path) }
  grouped(value = true): this { this.#grouped = value; return this }
  icons(value: Readonly<Record<string, string>>): this { this.#icons = Object.freeze({ ...value }); return this }
  inline(value = true): this { this.#inline = value; return this }
  protected override fieldProperties(): JsonObject { return { ...super.fieldProperties(), grouped: this.#grouped, icons: this.#icons, inline: this.#inline } }
}

abstract class DateField<TRecord extends object, TPath extends FieldPath<TRecord>> extends Field<TRecord, TPath> {
  #closeOnDateSelection = false
  #displayFormat: string | null = null
  #firstDayOfWeek = 1
  #format: string | null = null
  #maxDate: Date | string | null = null
  #minDate: Date | string | null = null
  #native = true
  #seconds = false
  #timezone: string | null = null
  closeOnDateSelection(value = true): this { this.#closeOnDateSelection = value; return this }
  displayFormat(value: string | null): this { this.#displayFormat = value; return this }
  firstDayOfWeek(value: number): this { this.#firstDayOfWeek = value; return this }
  format(value: string | null): this { this.#format = value; return this }
  maxDate(value: Date | string | null): this { this.#maxDate = value; return this }
  minDate(value: Date | string | null): this { this.#minDate = value; return this }
  native(value = true): this { this.#native = value; return this }
  seconds(value = true): this { this.#seconds = value; return this }
  timezone(value: string | null): this { this.#timezone = value; return this }
  protected override fieldProperties(): JsonObject { return { closeOnDateSelection: this.#closeOnDateSelection, displayFormat: this.#displayFormat, firstDayOfWeek: this.#firstDayOfWeek, format: this.#format, maxDate: this.#maxDate instanceof Date ? this.#maxDate.toISOString() : this.#maxDate, minDate: this.#minDate instanceof Date ? this.#minDate.toISOString() : this.#minDate, native: this.#native, seconds: this.#seconds, timezone: this.#timezone } }
}

export class DatePicker<TRecord extends object = Record<string, unknown>, TPath extends FieldPath<TRecord> = FieldPath<TRecord>> extends DateField<TRecord, TPath> {
  private constructor(path: TPath) { super('date', path) }
  static make<TRecord extends object = Record<string, unknown>, TPath extends FieldPath<TRecord> = FieldPath<TRecord>>(path: TPath): DatePicker<TRecord, TPath> { return new DatePicker(path) }
}

export class TimePicker<TRecord extends object = Record<string, unknown>, TPath extends FieldPath<TRecord> = FieldPath<TRecord>> extends DateField<TRecord, TPath> {
  private constructor(path: TPath) { super('time', path) }
  static make<TRecord extends object = Record<string, unknown>, TPath extends FieldPath<TRecord> = FieldPath<TRecord>>(path: TPath): TimePicker<TRecord, TPath> { return new TimePicker(path) }
}

export class DateTimePicker<TRecord extends object = Record<string, unknown>, TPath extends FieldPath<TRecord> = FieldPath<TRecord>> extends DateField<TRecord, TPath> {
  private constructor(path: TPath) { super('date-time', path) }
  static make<TRecord extends object = Record<string, unknown>, TPath extends FieldPath<TRecord> = FieldPath<TRecord>>(path: TPath): DateTimePicker<TRecord, TPath> { return new DateTimePicker(path) }
}

export class FileUpload<TRecord extends object = Record<string, unknown>, TPath extends FieldPath<TRecord> = FieldPath<TRecord>> extends Field<TRecord, TPath> {
  #acceptedFileTypes: readonly string[] = []
  #directory: string | null = null
  #disk: string | null = null
  #downloadable = false
  #image = false
  #maxFiles: number | null = null
  #maxSize: number | null = null
  #minFiles: number | null = null
  #multiple = false
  #openable = false
  #preserveFilenames = false
  #previewable = true
  #visibility: 'private' | 'public' | null = null
  private constructor(path: TPath) { super('panels:field:upload', path) }
  static make<TRecord extends object = Record<string, unknown>, TPath extends FieldPath<TRecord> = FieldPath<TRecord>>(path: TPath): FileUpload<TRecord, TPath> { return new FileUpload(path) }
  acceptedFileTypes(value: readonly string[]): this { this.#acceptedFileTypes = Object.freeze([...value]); return this }
  directory(value: string | null): this { this.#directory = value; return this }
  disk(value: string | null): this { this.#disk = value; return this }
  downloadable(value = true): this { this.#downloadable = value; return this }
  image(value = true): this { this.#image = value; return this }
  maxFiles(value: number | null): this { this.#maxFiles = value; return this }
  maxSize(value: number | null): this { this.#maxSize = value; return this }
  minFiles(value: number | null): this { this.#minFiles = value; return this }
  multiple(value = true): this { this.#multiple = value; return this }
  openable(value = true): this { this.#openable = value; return this }
  preserveFilenames(value = true): this { this.#preserveFilenames = value; return this }
  previewable(value = true): this { this.#previewable = value; return this }
  visibility(value: 'private' | 'public' | null): this { this.#visibility = value; return this }
  protected override fieldProperties(): JsonObject {
    const acceptedMimeTypes = this.#acceptedFileTypes.length > 0
      ? this.#acceptedFileTypes
      : this.#image
        ? ['image/jpeg', 'image/png', 'image/webp']
        : ['application/octet-stream']
    const knownExtensions: Readonly<Record<string, readonly string[]>> = {
      'application/pdf': ['pdf'],
      'image/gif': ['gif'],
      'image/jpeg': ['jpg', 'jpeg'],
      'image/png': ['png'],
      'image/svg+xml': ['svg'],
      'image/webp': ['webp'],
    }
    const acceptedExtensions = [...new Set(acceptedMimeTypes.flatMap((mimeType) => {
      const known = knownExtensions[mimeType]
      if (known) return known
      const subtype = mimeType.split('/')[1]?.split('+')[0]?.replace(/^x-/u, '')
      return subtype ? [subtype] : []
    }))]
    return {
      acceptedFileTypes: [...this.#acceptedFileTypes],
      directory: this.#directory,
      disk: this.#disk,
      downloadable: this.#downloadable,
      image: this.#image,
      maxFiles: this.#maxFiles,
      maxSize: this.#maxSize,
      minFiles: this.#minFiles,
      multiple: this.#multiple,
      openable: this.#openable,
      preserveFilenames: this.#preserveFilenames,
      previewable: this.#previewable,
      uploadPolicy: {
        acceptedExtensions: acceptedExtensions.length > 0 ? acceptedExtensions : ['bin'],
        acceptedMimeTypes: [...acceptedMimeTypes],
        directory: this.#directory ?? 'panels/uploads',
        disk: this.#disk ?? 'local',
        expiresInSeconds: 3_600,
        imageOnly: this.#image,
        maximumFiles: this.#multiple ? this.#maxFiles ?? 100 : 1,
        maximumSize: this.#maxSize ?? 10_485_760,
        private: this.#visibility !== 'public',
      },
      visibility: this.#visibility,
    }
  }
}

abstract class CollectionField<TRecord extends object, TPath extends FieldPath<TRecord>> extends Field<TRecord, TPath> {
  #addActionLabel: string | null = null
  #cloneable = false
  #collapsible = false
  #defaultItems = 1
  #itemLabel: string | null = null
  #maxItems: number | null = null
  #minItems: number | null = null
  #reorderable = true
  addActionLabel(value: string | null): this { this.#addActionLabel = value; return this }
  cloneable(value = true): this { this.#cloneable = value; return this }
  collapsible(value = true): this { this.#collapsible = value; return this }
  defaultItems(value: number): this { this.#defaultItems = value; return this }
  itemLabel(value: string | null): this { this.#itemLabel = value; return this }
  maxItems(value: number | null): this { this.#maxItems = value; return this }
  minItems(value: number | null): this { this.#minItems = value; return this }
  reorderable(value = true): this { this.#reorderable = value; return this }
  protected override fieldProperties(): JsonObject { return { addActionLabel: this.#addActionLabel, cloneable: this.#cloneable, collapsible: this.#collapsible, defaultItems: this.#defaultItems, itemLabel: this.#itemLabel, maxItems: this.#maxItems, minItems: this.#minItems, reorderable: this.#reorderable } }
}

export class Repeater<TRecord extends object = Record<string, unknown>, TPath extends FieldPath<TRecord> = FieldPath<TRecord>> extends CollectionField<TRecord, TPath> {
  #schema: readonly Component[] = []
  private constructor(path: TPath) { super('repeater', path) }
  static make<TRecord extends object = Record<string, unknown>, TPath extends FieldPath<TRecord> = FieldPath<TRecord>>(path: TPath): Repeater<TRecord, TPath> { return new Repeater(path) }
  schema(value: readonly Component[]): this { this.#schema = Object.freeze([...value]); return this }
  relationship(name?: string): this { return this.extraInputAttributes({ relationship: name ?? this.path }) }
  protected override fieldProperties(): JsonObject { return { ...super.fieldProperties(), schema: this.#schema.map(compileSchemaComponentManifest) } }
}

export class Builder<TRecord extends object = Record<string, unknown>, TPath extends FieldPath<TRecord> = FieldPath<TRecord>> extends CollectionField<TRecord, TPath> {
  #blocks: readonly BuilderBlock[] = []
  private constructor(path: TPath) { super('builder', path) }
  static make<TRecord extends object = Record<string, unknown>, TPath extends FieldPath<TRecord> = FieldPath<TRecord>>(path: TPath): Builder<TRecord, TPath> { return new Builder(path) }
  blocks(value: readonly BuilderBlock[]): this { this.#blocks = Object.freeze([...value]); return this }
  protected override fieldProperties(): JsonObject { return { ...super.fieldProperties(), blocks: this.#blocks.map(compileSchemaComponentManifest) } }
}

export class BuilderBlock extends Component {
  #icon: string | null = null
  #label: string | null = null
  #schema: readonly Component[] = []
  private constructor(name: string) { super('builder-block', name) }
  static make(name: string): BuilderBlock { return new BuilderBlock(name) }
  icon(value: string | null): this { this.#icon = value; return this }
  label(value: string | null): this { this.#label = value; return this }
  schema(value: readonly Component[]): this { this.#schema = Object.freeze([...value]); return this }
  protected override componentProperties(): JsonObject { return { icon: this.#icon, label: this.#label, schema: this.#schema.map(compileSchemaComponentManifest) } }
}

abstract class SimpleField<TRecord extends object, TPath extends FieldPath<TRecord>> extends Field<TRecord, TPath> {
  protected constructor(type: string, path: TPath) { super(type, path) }
}

export class RichEditor<TRecord extends object = Record<string, unknown>, TPath extends FieldPath<TRecord> = FieldPath<TRecord>> extends SimpleField<TRecord, TPath> {
  private constructor(path: TPath) { super('rich-editor', path) }
  static make<TRecord extends object = Record<string, unknown>, TPath extends FieldPath<TRecord> = FieldPath<TRecord>>(path: TPath): RichEditor<TRecord, TPath> { return new RichEditor(path) }
}
export class MarkdownEditor<TRecord extends object = Record<string, unknown>, TPath extends FieldPath<TRecord> = FieldPath<TRecord>> extends SimpleField<TRecord, TPath> {
  private constructor(path: TPath) { super('markdown-editor', path) }
  static make<TRecord extends object = Record<string, unknown>, TPath extends FieldPath<TRecord> = FieldPath<TRecord>>(path: TPath): MarkdownEditor<TRecord, TPath> { return new MarkdownEditor(path) }
}
export class TagsInput<TRecord extends object = Record<string, unknown>, TPath extends FieldPath<TRecord> = FieldPath<TRecord>> extends SimpleField<TRecord, TPath> {
  private constructor(path: TPath) { super('tags-input', path) }
  static make<TRecord extends object = Record<string, unknown>, TPath extends FieldPath<TRecord> = FieldPath<TRecord>>(path: TPath): TagsInput<TRecord, TPath> { return new TagsInput(path) }
}
export class KeyValue<TRecord extends object = Record<string, unknown>, TPath extends FieldPath<TRecord> = FieldPath<TRecord>> extends SimpleField<TRecord, TPath> {
  private constructor(path: TPath) { super('key-value', path) }
  static make<TRecord extends object = Record<string, unknown>, TPath extends FieldPath<TRecord> = FieldPath<TRecord>>(path: TPath): KeyValue<TRecord, TPath> { return new KeyValue(path) }
}
export class ColorPicker<TRecord extends object = Record<string, unknown>, TPath extends FieldPath<TRecord> = FieldPath<TRecord>> extends SimpleField<TRecord, TPath> {
  private constructor(path: TPath) { super('color-picker', path) }
  static make<TRecord extends object = Record<string, unknown>, TPath extends FieldPath<TRecord> = FieldPath<TRecord>>(path: TPath): ColorPicker<TRecord, TPath> { return new ColorPicker(path) }
}
export class Slider<TRecord extends object = Record<string, unknown>, TPath extends FieldPath<TRecord> = FieldPath<TRecord>> extends SimpleField<TRecord, TPath> {
  private constructor(path: TPath) { super('slider', path) }
  static make<TRecord extends object = Record<string, unknown>, TPath extends FieldPath<TRecord> = FieldPath<TRecord>>(path: TPath): Slider<TRecord, TPath> { return new Slider(path) }
}
export class CodeEditor<TRecord extends object = Record<string, unknown>, TPath extends FieldPath<TRecord> = FieldPath<TRecord>> extends SimpleField<TRecord, TPath> {
  private constructor(path: TPath) { super('code-editor', path) }
  static make<TRecord extends object = Record<string, unknown>, TPath extends FieldPath<TRecord> = FieldPath<TRecord>>(path: TPath): CodeEditor<TRecord, TPath> { return new CodeEditor(path) }
}
export class Hidden<TRecord extends object = Record<string, unknown>, TPath extends FieldPath<TRecord> = FieldPath<TRecord>> extends SimpleField<TRecord, TPath> {
  private constructor(path: TPath) { super('hidden', path) }
  static make<TRecord extends object = Record<string, unknown>, TPath extends FieldPath<TRecord> = FieldPath<TRecord>>(path: TPath): Hidden<TRecord, TPath> { return new Hidden(path) }
}

export interface FieldFactory<TRecord extends object> {
  builder<const TPath extends FieldPath<TRecord>>(path: TPath): Builder<TRecord, TPath>
  builderBlock(name: string): BuilderBlock
  checkbox<const TPath extends FieldPathFor<TRecord, boolean>>(path: TPath): Checkbox<TRecord, TPath>
  checkboxList<const TPath extends FieldPath<TRecord>>(path: TPath): CheckboxList<TRecord, TPath>
  codeEditor<const TPath extends FieldPath<TRecord>>(path: TPath): CodeEditor<TRecord, TPath>
  colorPicker<const TPath extends FieldPath<TRecord>>(path: TPath): ColorPicker<TRecord, TPath>
  datePicker<const TPath extends FieldPath<TRecord>>(path: TPath): DatePicker<TRecord, TPath>
  dateTimePicker<const TPath extends FieldPath<TRecord>>(path: TPath): DateTimePicker<TRecord, TPath>
  fileUpload<const TPath extends FieldPath<TRecord>>(path: TPath): FileUpload<TRecord, TPath>
  hidden<const TPath extends FieldPath<TRecord>>(path: TPath): Hidden<TRecord, TPath>
  keyValue<const TPath extends FieldPath<TRecord>>(path: TPath): KeyValue<TRecord, TPath>
  markdownEditor<const TPath extends FieldPath<TRecord>>(path: TPath): MarkdownEditor<TRecord, TPath>
  radio<const TPath extends FieldPath<TRecord>>(path: TPath): Radio<TRecord, TPath>
  repeater<const TPath extends FieldPath<TRecord>>(path: TPath): Repeater<TRecord, TPath>
  richEditor<const TPath extends FieldPath<TRecord>>(path: TPath): RichEditor<TRecord, TPath>
  select<const TPath extends FieldPath<TRecord>>(path: TPath): Select<TRecord, TPath>
  slider<const TPath extends FieldPath<TRecord>>(path: TPath): Slider<TRecord, TPath>
  tagsInput<const TPath extends FieldPath<TRecord>>(path: TPath): TagsInput<TRecord, TPath>
  textarea<const TPath extends FieldPathFor<TRecord, string>>(path: TPath): Textarea<TRecord, TPath>
  textInput<const TPath extends FieldPathFor<TRecord, number | string>>(path: TPath): TextInput<TRecord, TPath>
  timePicker<const TPath extends FieldPath<TRecord>>(path: TPath): TimePicker<TRecord, TPath>
  toggle<const TPath extends FieldPathFor<TRecord, boolean>>(path: TPath): Toggle<TRecord, TPath>
  toggleButtons<const TPath extends FieldPath<TRecord>>(path: TPath): ToggleButtons<TRecord, TPath>
}

export function createFieldFactory<TRecord extends object>(): FieldFactory<TRecord> {
  return Object.freeze({
    builder: <const TPath extends FieldPath<TRecord>>(path: TPath) => Builder.make<TRecord, TPath>(path),
    builderBlock: (name: string) => BuilderBlock.make(name),
    checkbox: <const TPath extends FieldPathFor<TRecord, boolean>>(path: TPath) => Checkbox.make<TRecord, TPath>(path),
    checkboxList: <const TPath extends FieldPath<TRecord>>(path: TPath) => CheckboxList.make<TRecord, TPath>(path),
    codeEditor: <const TPath extends FieldPath<TRecord>>(path: TPath) => CodeEditor.make<TRecord, TPath>(path),
    colorPicker: <const TPath extends FieldPath<TRecord>>(path: TPath) => ColorPicker.make<TRecord, TPath>(path),
    datePicker: <const TPath extends FieldPath<TRecord>>(path: TPath) => DatePicker.make<TRecord, TPath>(path),
    dateTimePicker: <const TPath extends FieldPath<TRecord>>(path: TPath) => DateTimePicker.make<TRecord, TPath>(path),
    fileUpload: <const TPath extends FieldPath<TRecord>>(path: TPath) => FileUpload.make<TRecord, TPath>(path),
    hidden: <const TPath extends FieldPath<TRecord>>(path: TPath) => Hidden.make<TRecord, TPath>(path),
    keyValue: <const TPath extends FieldPath<TRecord>>(path: TPath) => KeyValue.make<TRecord, TPath>(path),
    markdownEditor: <const TPath extends FieldPath<TRecord>>(path: TPath) => MarkdownEditor.make<TRecord, TPath>(path),
    radio: <const TPath extends FieldPath<TRecord>>(path: TPath) => Radio.make<TRecord, TPath>(path),
    repeater: <const TPath extends FieldPath<TRecord>>(path: TPath) => Repeater.make<TRecord, TPath>(path),
    richEditor: <const TPath extends FieldPath<TRecord>>(path: TPath) => RichEditor.make<TRecord, TPath>(path),
    select: <const TPath extends FieldPath<TRecord>>(path: TPath) => Select.make<TRecord, TPath>(path),
    slider: <const TPath extends FieldPath<TRecord>>(path: TPath) => Slider.make<TRecord, TPath>(path),
    tagsInput: <const TPath extends FieldPath<TRecord>>(path: TPath) => TagsInput.make<TRecord, TPath>(path),
    textarea: <const TPath extends FieldPathFor<TRecord, string>>(path: TPath) => Textarea.make<TRecord, TPath>(path),
    textInput: <const TPath extends FieldPathFor<TRecord, number | string>>(path: TPath) => TextInput.make<TRecord, TPath>(path),
    timePicker: <const TPath extends FieldPath<TRecord>>(path: TPath) => TimePicker.make<TRecord, TPath>(path),
    toggle: <const TPath extends FieldPathFor<TRecord, boolean>>(path: TPath) => Toggle.make<TRecord, TPath>(path),
    toggleButtons: <const TPath extends FieldPath<TRecord>>(path: TPath) => ToggleButtons.make<TRecord, TPath>(path),
  })
}
