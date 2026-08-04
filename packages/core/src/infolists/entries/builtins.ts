import { toJsonValue } from '../../protocol/serialization'
import type { JsonObject } from '../../protocol/json'
import type { RecordPathFor } from '../../tables/columns/types'
import type { RecordTypeSource, RecordTypeValue } from '../../inference/type-source'
import { EntryBuilder } from './base'
import type { CustomEntryType } from './custom'
import type { EntryRecordPath, EntryRecordPathValue } from './types'

export class TextEntry<TRecord, TPath extends EntryRecordPath<TRecord>> extends EntryBuilder<TRecord, EntryRecordPathValue<TRecord, TPath>, 'text'> {
  constructor(path: TPath) {
    super('text', { kind: 'path', path })
  }

  prefix(value: string): this {
    return this.addFormat({ kind: 'prefix', value })
  }

  suffix(value: string): this {
    return this.addFormat({ kind: 'suffix', value })
  }

  limit(characters: number): this {
    if (!Number.isSafeInteger(characters) || characters < 1) throw new Error('Text entry limits must be positive integers')
    return this.addFormat({ characters, kind: 'limit' })
  }

  list(separator = ', '): this {
    if (separator.length > 10) throw new Error('List separators cannot exceed 10 characters')
    return this.addFormat({ kind: 'list', separator })
  }

  date(options: Intl.DateTimeFormatOptions = {}): this {
    return this.addFormat({ kind: 'date', options: toJsonValue(options) })
  }

  number(options: Intl.NumberFormatOptions = {}): this {
    return this.addFormat({ kind: 'number', options: toJsonValue(options) })
  }

  badge(value = true): this {
    return this.addFormat({ kind: 'badge', value })
  }

  markdown(value = true): this {
    return this.addFormat({ kind: 'markdown', rawHtml: false, value })
  }

  richText(sanitizer: string): this {
    if (!/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u.test(sanitizer)) throw new Error('Rich text sanitizers require a stable identifier')
    return this.addFormat({ kind: 'rich-text', sanitizer, structured: true })
  }
}

export class IconEntry<TRecord, TPath extends EntryRecordPath<TRecord>> extends EntryBuilder<TRecord, EntryRecordPathValue<TRecord, TPath>, 'icon'> {
  constructor(path: TPath) {
    super('icon', { kind: 'path', path })
  }

  icon(name: string): this {
    if (!/^[a-z][a-z0-9-]*$/u.test(name)) throw new Error('Entry icons require stable kebab-case names')
    return this.addFormat({ kind: 'icon', name })
  }

  boolean(truthy = 'check', falsy = 'x-mark'): this {
    if (![truthy, falsy].every(name => /^[a-z][a-z0-9-]*$/u.test(name))) {
      throw new Error('Boolean entry icons require stable kebab-case names')
    }
    return this.addFormat({ falsy, kind: 'boolean-icons', truthy })
  }
}

export class BooleanEntry<TRecord, TPath extends RecordPathFor<TRecord, boolean>> extends EntryBuilder<TRecord, boolean, 'boolean'> {
  constructor(path: TPath) {
    super('boolean', { kind: 'path', path })
  }

  icons(truthy = 'check', falsy = 'x-mark'): this {
    return this.addFormat({ falsy, kind: 'boolean-icons', truthy })
  }
}

export class ImageEntry<TRecord, TPath extends RecordPathFor<TRecord, string>> extends EntryBuilder<TRecord, string, 'image'> {
  constructor(path: TPath) {
    super('image', { kind: 'path', path })
  }

  circular(value = true): this {
    return this.addFormat({ kind: 'circular', value })
  }

  size(pixels: number): this {
    if (!Number.isSafeInteger(pixels) || pixels < 1 || pixels > 4096) throw new Error('Image entry sizes must be integers from 1 to 4096')
    return this.addFormat({ kind: 'size', pixels })
  }

  alt(value: string): this {
    return this.addFormat({ kind: 'alt', value })
  }
}

export class ColorEntry<TRecord, TPath extends RecordPathFor<TRecord, string>> extends EntryBuilder<TRecord, string, 'color'> {
  constructor(path: TPath) {
    super('color', { kind: 'path', path })
  }
}

export class CodeEntry<TRecord, TPath extends EntryRecordPath<TRecord>> extends EntryBuilder<TRecord, EntryRecordPathValue<TRecord, TPath>, 'code'> {
  constructor(path: TPath) {
    super('code', { kind: 'path', path })
  }

  language(value: string): this {
    if (!/^[a-z][a-z0-9+#.-]*$/u.test(value)) throw new Error('Code entry languages require a stable identifier')
    return this.addFormat({ kind: 'language', value })
  }

  lineNumbers(value = true): this {
    return this.addFormat({ kind: 'line-numbers', value })
  }
}

export class KeyValueEntry<TRecord, TPath extends EntryRecordPath<TRecord>> extends EntryBuilder<TRecord, EntryRecordPathValue<TRecord, TPath>, 'key-value'> {
  constructor(path: TPath) {
    super('key-value', { kind: 'json', path })
  }

  keyLabel(value: string): this {
    return this.addFormat({ kind: 'key-label', value })
  }

  valueLabel(value: string): this {
    return this.addFormat({ kind: 'value-label', value })
  }
}

export class RepeatableEntry<TRecord, TPath extends EntryRecordPath<TRecord>> extends EntryBuilder<TRecord, EntryRecordPathValue<TRecord, TPath>, 'repeatable'> {
  constructor(path: TPath) {
    super('repeatable', { kind: 'path', path })
  }

  schema(entries: readonly string[]): this {
    if (entries.some(entry => !/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u.test(entry))) {
      throw new Error('Repeatable entry schema items require stable identifiers')
    }
    if (new Set(entries).size !== entries.length) throw new Error('Repeatable entry schema items must be unique')
    return this.addFormat({ entries: [...entries], kind: 'schema' })
  }
}

export class CustomEntry<
  TRecord,
  TValue,
  TType extends CustomEntryType,
> extends EntryBuilder<TRecord, TValue, TType> {
  constructor(type: TType, path: EntryRecordPath<TRecord>, configuration: JsonObject = {}) {
    if (!/^[a-z][a-z0-9.-]*:entry:[a-z][a-z0-9._-]*$/u.test(type)) throw new Error('Custom entry type IDs must use namespace:entry:name')
    super(type, { kind: 'path', path })
    this.configuration(configuration)
  }
}

export interface EntryFactory<TRecord> {
  boolean<const TPath extends RecordPathFor<TRecord, boolean>>(path: TPath): BooleanEntry<TRecord, TPath>
  code<const TPath extends EntryRecordPath<TRecord>>(path: TPath): CodeEntry<TRecord, TPath>
  color<const TPath extends RecordPathFor<TRecord, string>>(path: TPath): ColorEntry<TRecord, TPath>
  custom<const TPath extends EntryRecordPath<TRecord>, const TType extends CustomEntryType>(type: TType, path: TPath, configuration?: JsonObject): CustomEntry<TRecord, unknown, TType>
  icon<const TPath extends EntryRecordPath<TRecord>>(path: TPath): IconEntry<TRecord, TPath>
  image<const TPath extends RecordPathFor<TRecord, string>>(path: TPath): ImageEntry<TRecord, TPath>
  keyValue<const TPath extends EntryRecordPath<TRecord>>(path: TPath): KeyValueEntry<TRecord, TPath>
  repeatable<const TPath extends EntryRecordPath<TRecord>>(path: TPath): RepeatableEntry<TRecord, TPath>
  text<const TPath extends EntryRecordPath<TRecord>>(path: TPath): TextEntry<TRecord, TPath>
}

export type EntryRecordSource<TRecord extends object> = RecordTypeSource & (
  | { readonly prototype: TRecord }
  | { create(...parameters: never[]): TRecord | Promise<TRecord> }
)

export function entriesFor<TSource extends RecordTypeSource>(_source: TSource): EntryFactory<RecordTypeValue<TSource>> {
  return {
    boolean: path => new BooleanEntry(path),
    code: path => new CodeEntry(path),
    color: path => new ColorEntry(path),
    custom: (type, path, configuration) => new CustomEntry(type, path, configuration),
    icon: path => new IconEntry(path),
    image: path => new ImageEntry(path),
    keyValue: path => new KeyValueEntry(path),
    repeatable: path => new RepeatableEntry(path),
    text: path => new TextEntry(path),
  }
}
