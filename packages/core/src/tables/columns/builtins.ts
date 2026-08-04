import { toJsonValue } from '../../protocol/serialization'
import type { JsonObject, JsonPrimitive } from '../../protocol/json'
import type { ExtensionTypeId } from '../../plugins/type-id'
import type { RecordTypeSource, RecordTypeValue } from '../../inference/type-source'
import { ColumnBuilder } from './base'
import type { RecordPath, RecordPathFor } from './types'

export interface SelectColumnOption extends JsonObject {
  label: string
  value: JsonPrimitive
}

export class TextColumn<TRecord, TPath extends RecordPath<TRecord>> extends ColumnBuilder<TRecord, TPath, 'text'> {
  constructor(path: TPath) {
    super('text', path)
  }

  badge(value = true): this {
    return this.addFormatter({ kind: 'badge', value })
  }

  date(options: Intl.DateTimeFormatOptions = {}): this {
    return this.addFormatter({ kind: 'date', options: toJsonValue(options) })
  }

  time(options: Intl.DateTimeFormatOptions = {}): this {
    return this.addFormatter({ kind: 'time', options: toJsonValue(options) })
  }

  dateTime(options: Intl.DateTimeFormatOptions = {}): this {
    return this.addFormatter({ kind: 'date-time', options: toJsonValue(options) })
  }

  relativeTime(value = true): this {
    return this.addFormatter({ kind: 'relative-time', value })
  }

  number(options: Intl.NumberFormatOptions = {}): this {
    return this.addFormatter({ kind: 'number', options: toJsonValue(options) })
  }

  money(currency: string, options: Omit<Intl.NumberFormatOptions, 'currency' | 'style'> = {}): this {
    if (!/^[A-Z]{3}$/u.test(currency)) throw new Error('Money formatters require an uppercase ISO 4217 currency code')
    return this.addFormatter({ currency, kind: 'money', options: toJsonValue(options) })
  }

  markdown(value = true): this {
    return this.addFormatter({ kind: 'markdown', value })
  }

  list(separator = ', '): this {
    if (separator.length > 10) throw new Error('List separators cannot exceed 10 characters')
    return this.addFormatter({ kind: 'list', separator })
  }

  limit(characters: number): this {
    if (!Number.isSafeInteger(characters) || characters < 1) throw new Error('Text limits must be positive integers')
    return this.addFormatter({ characters, kind: 'limit' })
  }

  words(count: number): this {
    if (!Number.isSafeInteger(count) || count < 1) throw new Error('Word limits must be positive integers')
    return this.addFormatter({ count, kind: 'words' })
  }

  icon(name: string): this {
    if (!/^[a-z][a-z0-9-]*$/u.test(name)) throw new Error('Column icons require stable kebab-case names')
    return this.addFormatter({ kind: 'icon', name })
  }

  color(value: string): this {
    if (!/^(?:#[\da-f]{3,8}|[a-z][a-z0-9-]*)$/iu.test(value)) throw new Error('Column colors must be semantic names or hex values')
    return this.addFormatter({ kind: 'color', value })
  }

  prefix(value: string): this {
    return this.addFormatter({ kind: 'prefix', value })
  }

  suffix(value: string): this {
    return this.addFormatter({ kind: 'suffix', value })
  }
}

export class IconColumn<TRecord, TPath extends RecordPath<TRecord>> extends ColumnBuilder<TRecord, TPath, 'icon'> {
  constructor(path: TPath) {
    super('icon', path)
  }

  icons(truthy: string, falsy: string): this {
    if (![truthy, falsy].every(icon => /^[a-z][a-z0-9-]*$/u.test(icon))) throw new Error('Column icons require stable kebab-case names')
    return this.addFormatter({ falsy, kind: 'boolean-icons', truthy })
  }
}

export class BooleanColumn<TRecord, TPath extends RecordPathFor<TRecord, boolean>> extends ColumnBuilder<TRecord, TPath, 'boolean'> {
  constructor(path: TPath) {
    super('boolean', path)
  }

  icons(truthy = 'check', falsy = 'x-mark'): this {
    return this.addFormatter({ falsy, kind: 'boolean-icons', truthy })
  }
}

export class ImageColumn<TRecord, TPath extends RecordPathFor<TRecord, string>> extends ColumnBuilder<TRecord, TPath, 'image'> {
  constructor(path: TPath) {
    super('image', path)
  }

  circular(value = true): this {
    return this.addFormatter({ kind: 'circular', value })
  }

  size(pixels: number): this {
    if (!Number.isSafeInteger(pixels) || pixels < 1 || pixels > 2048) throw new Error('Image column sizes must be integers from 1 to 2048')
    return this.addFormatter({ kind: 'size', pixels })
  }
}

export class ColorColumn<TRecord, TPath extends RecordPathFor<TRecord, string>> extends ColumnBuilder<TRecord, TPath, 'color'> {
  constructor(path: TPath) {
    super('color', path)
  }
}

export class CheckboxColumn<TRecord, TPath extends RecordPathFor<TRecord, boolean>> extends ColumnBuilder<TRecord, TPath, 'checkbox'> {
  constructor(path: TPath) {
    super('checkbox', path)
  }

  editable(action: string): this {
    return this.inlineEditor({ action, kind: 'checkbox' })
  }
}

export class SelectColumn<TRecord, TPath extends RecordPath<TRecord>> extends ColumnBuilder<TRecord, TPath, 'select'> {
  constructor(path: TPath) {
    super('select', path)
  }

  editable(action: string, options: readonly SelectColumnOption[]): this {
    const values = new Set<string>()
    for (const option of options) {
      const key = JSON.stringify(option.value)
      if (values.has(key)) throw new Error('Select column option values must be unique')
      values.add(key)
    }
    return this.inlineEditor({ action, kind: 'select', options: options.map(option => ({ ...option })) })
  }
}

export class ToggleColumn<TRecord, TPath extends RecordPathFor<TRecord, boolean>> extends ColumnBuilder<TRecord, TPath, 'toggle'> {
  constructor(path: TPath) {
    super('toggle', path)
  }

  editable(action: string): this {
    return this.inlineEditor({ action, kind: 'toggle' })
  }
}

export class TextInputColumn<TRecord, TPath extends RecordPathFor<TRecord, string>> extends ColumnBuilder<TRecord, TPath, 'text-input'> {
  constructor(path: TPath) {
    super('text-input', path)
  }

  editable(action: string, options: { readonly maximumLength?: number, readonly placeholder?: string } = {}): this {
    if (options.maximumLength !== undefined && (!Number.isSafeInteger(options.maximumLength) || options.maximumLength < 1 || options.maximumLength > 100_000)) {
      throw new Error('Inline text maximum length must be an integer from 1 to 100000')
    }
    return this.inlineEditor({ action, kind: 'text-input', ...options })
  }
}

export class CustomColumn<
  TRecord,
  TPath extends RecordPath<TRecord>,
  TType extends ExtensionTypeId<'column'> | `${string}:column:${string}`,
> extends ColumnBuilder<TRecord, TPath, TType> {
  constructor(type: TType, path: TPath, configuration: JsonObject = {}) {
    if (!/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*:column:[a-z][a-z0-9-]*$/u.test(type)) throw new Error('Custom column type IDs must use namespace:column:name')
    super(type, path)
    this.addFormatter({ configuration: toJsonValue(configuration), kind: 'custom' })
  }
}

export interface ColumnFactory<TRecord> {
  boolean<const TPath extends RecordPathFor<TRecord, boolean>>(path: TPath): BooleanColumn<TRecord, TPath>
  checkbox<const TPath extends RecordPathFor<TRecord, boolean>>(path: TPath): CheckboxColumn<TRecord, TPath>
  color<const TPath extends RecordPathFor<TRecord, string>>(path: TPath): ColorColumn<TRecord, TPath>
  custom<const TPath extends RecordPath<TRecord>, const TType extends ExtensionTypeId<'column'> | `${string}:column:${string}`>(type: TType, path: TPath, configuration?: JsonObject): CustomColumn<TRecord, TPath, TType>
  icon<const TPath extends RecordPath<TRecord>>(path: TPath): IconColumn<TRecord, TPath>
  image<const TPath extends RecordPathFor<TRecord, string>>(path: TPath): ImageColumn<TRecord, TPath>
  select<const TPath extends RecordPath<TRecord>>(path: TPath): SelectColumn<TRecord, TPath>
  text<const TPath extends RecordPath<TRecord>>(path: TPath): TextColumn<TRecord, TPath>
  textInput<const TPath extends RecordPathFor<TRecord, string>>(path: TPath): TextInputColumn<TRecord, TPath>
  toggle<const TPath extends RecordPathFor<TRecord, boolean>>(path: TPath): ToggleColumn<TRecord, TPath>
}

export type ColumnRecordSource<TRecord extends object> = RecordTypeSource & (
  | { readonly prototype: TRecord }
  | { create(...parameters: never[]): TRecord | Promise<TRecord> }
)

export function columnsFor<TSource extends RecordTypeSource>(source: TSource): ColumnFactory<RecordTypeValue<TSource>>
export function columnsFor<TSource extends RecordTypeSource>(_source: TSource): ColumnFactory<RecordTypeValue<TSource>> {
  return {
    boolean: path => new BooleanColumn(path),
    checkbox: path => new CheckboxColumn(path),
    color: path => new ColorColumn(path),
    custom: (type, path, configuration) => new CustomColumn(type, path, configuration),
    icon: path => new IconColumn(path),
    image: path => new ImageColumn(path),
    select: path => new SelectColumn(path),
    text: path => new TextColumn(path),
    textInput: path => new TextInputColumn(path),
    toggle: path => new ToggleColumn(path),
  }
}
