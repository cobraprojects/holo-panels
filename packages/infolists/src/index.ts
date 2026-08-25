import {
  CodeEntry as CoreCodeEntry,
  ColorEntry as CoreColorEntry,
  IconEntry as CoreIconEntry,
  ImageEntry as CoreImageEntry,
  KeyValueInfolistEntry as CoreKeyValueEntry,
  RepeatableEntry as CoreRepeatableEntry,
  TextEntry as CoreTextEntry,
  type EntryRecordPath,
  type RecordPathFor,
  type RegisteredPanelRecordForPath,
  type RegisteredPanelRecordForPathValue,
  type RegisteredPanelRecordPath,
  type RegisteredPanelRecordPathFor,
} from '@holo-js/panels-core'
import { Schema } from '@holo-js/panels-schemas'

export class Infolist<TRecord extends object = Record<string, unknown>> extends Schema<TRecord> {}

export class TextEntry<TRecord extends object = Record<string, unknown>, TPath extends EntryRecordPath<TRecord> = EntryRecordPath<TRecord>> extends CoreTextEntry<TRecord, TPath> {
  readonly recordPath: TPath
  private constructor(path: TPath) { super(path); this.recordPath = path }
  static make<const TPath extends RegisteredPanelRecordPath>(path: TPath): TextEntry<RegisteredPanelRecordForPath<TPath>, Extract<TPath, EntryRecordPath<RegisteredPanelRecordForPath<TPath>>>>
  static make<TRecord extends object, const TPath extends EntryRecordPath<TRecord>>(path: TPath): TextEntry<TRecord, TPath>
  static make(path: string): unknown { return new TextEntry<Record<string, unknown>, string>(path) }
}

export class IconEntry<TRecord extends object = Record<string, unknown>, TPath extends EntryRecordPath<TRecord> = EntryRecordPath<TRecord>> extends CoreIconEntry<TRecord, TPath> {
  readonly recordPath: TPath
  private constructor(path: TPath) { super(path); this.recordPath = path }
  static make<const TPath extends RegisteredPanelRecordPath>(path: TPath): IconEntry<RegisteredPanelRecordForPath<TPath>, Extract<TPath, EntryRecordPath<RegisteredPanelRecordForPath<TPath>>>>
  static make<TRecord extends object, const TPath extends EntryRecordPath<TRecord>>(path: TPath): IconEntry<TRecord, TPath>
  static make(path: string): unknown { return new IconEntry<Record<string, unknown>, string>(path) }
}

export class ImageEntry<TRecord extends object = Record<string, unknown>, TPath extends RecordPathFor<TRecord, string> = RecordPathFor<TRecord, string>> extends CoreImageEntry<TRecord, TPath> {
  readonly recordPath: TPath
  private constructor(path: TPath) { super(path); this.recordPath = path }
  static make<const TPath extends RegisteredPanelRecordPathFor<string>>(path: TPath): ImageEntry<RegisteredPanelRecordForPathValue<TPath, string>, Extract<TPath, RecordPathFor<RegisteredPanelRecordForPathValue<TPath, string>, string>>>
  static make<TRecord extends object, const TPath extends RecordPathFor<TRecord, string>>(path: TPath): ImageEntry<TRecord, TPath>
  static make(path: string): unknown { return new ImageEntry<Record<string, string>, string>(path) }
}

export class ColorEntry<TRecord extends object = Record<string, unknown>, TPath extends RecordPathFor<TRecord, string> = RecordPathFor<TRecord, string>> extends CoreColorEntry<TRecord, TPath> {
  readonly recordPath: TPath
  private constructor(path: TPath) { super(path); this.recordPath = path }
  static make<const TPath extends RegisteredPanelRecordPathFor<string>>(path: TPath): ColorEntry<RegisteredPanelRecordForPathValue<TPath, string>, Extract<TPath, RecordPathFor<RegisteredPanelRecordForPathValue<TPath, string>, string>>>
  static make<TRecord extends object, const TPath extends RecordPathFor<TRecord, string>>(path: TPath): ColorEntry<TRecord, TPath>
  static make(path: string): unknown { return new ColorEntry<Record<string, string>, string>(path) }
}

export class CodeEntry<TRecord extends object = Record<string, unknown>, TPath extends EntryRecordPath<TRecord> = EntryRecordPath<TRecord>> extends CoreCodeEntry<TRecord, TPath> {
  readonly recordPath: TPath
  private constructor(path: TPath) { super(path); this.recordPath = path }
  static make<const TPath extends RegisteredPanelRecordPath>(path: TPath): CodeEntry<RegisteredPanelRecordForPath<TPath>, Extract<TPath, EntryRecordPath<RegisteredPanelRecordForPath<TPath>>>>
  static make<TRecord extends object, const TPath extends EntryRecordPath<TRecord>>(path: TPath): CodeEntry<TRecord, TPath>
  static make(path: string): unknown { return new CodeEntry<Record<string, unknown>, string>(path) }
}

export class KeyValueEntry<TRecord extends object = Record<string, unknown>, TPath extends EntryRecordPath<TRecord> = EntryRecordPath<TRecord>> extends CoreKeyValueEntry<TRecord, TPath> {
  readonly recordPath: TPath
  private constructor(path: TPath) { super(path); this.recordPath = path }
  static make<const TPath extends RegisteredPanelRecordPath>(path: TPath): KeyValueEntry<RegisteredPanelRecordForPath<TPath>, Extract<TPath, EntryRecordPath<RegisteredPanelRecordForPath<TPath>>>>
  static make<TRecord extends object, const TPath extends EntryRecordPath<TRecord>>(path: TPath): KeyValueEntry<TRecord, TPath>
  static make(path: string): unknown { return new KeyValueEntry<Record<string, unknown>, string>(path) }
}

export class RepeatableEntry<TRecord extends object = Record<string, unknown>, TPath extends EntryRecordPath<TRecord> = EntryRecordPath<TRecord>> extends CoreRepeatableEntry<TRecord, TPath> {
  readonly recordPath: TPath
  private constructor(path: TPath) { super(path); this.recordPath = path }
  static make<const TPath extends RegisteredPanelRecordPath>(path: TPath): RepeatableEntry<RegisteredPanelRecordForPath<TPath>, Extract<TPath, EntryRecordPath<RegisteredPanelRecordForPath<TPath>>>>
  static make<TRecord extends object, const TPath extends EntryRecordPath<TRecord>>(path: TPath): RepeatableEntry<TRecord, TPath>
  static make(path: string): unknown { return new RepeatableEntry<Record<string, unknown>, string>(path) }
}

export interface EntryFactory<TRecord extends object> {
  code<const TPath extends EntryRecordPath<TRecord>>(path: TPath): CodeEntry<TRecord, TPath>
  color<const TPath extends RecordPathFor<TRecord, string>>(path: TPath): ColorEntry<TRecord, TPath>
  icon<const TPath extends EntryRecordPath<TRecord>>(path: TPath): IconEntry<TRecord, TPath>
  image<const TPath extends RecordPathFor<TRecord, string>>(path: TPath): ImageEntry<TRecord, TPath>
  keyValue<const TPath extends EntryRecordPath<TRecord>>(path: TPath): KeyValueEntry<TRecord, TPath>
  repeatable<const TPath extends EntryRecordPath<TRecord>>(path: TPath): RepeatableEntry<TRecord, TPath>
  text<const TPath extends EntryRecordPath<TRecord>>(path: TPath): TextEntry<TRecord, TPath>
}

export function createEntryFactory<TRecord extends object>(): EntryFactory<TRecord> {
  return Object.freeze({
    code: <const TPath extends EntryRecordPath<TRecord>>(path: TPath) => CodeEntry.make<TRecord, TPath>(path),
    color: <const TPath extends RecordPathFor<TRecord, string>>(path: TPath) => ColorEntry.make<TRecord, TPath>(path),
    icon: <const TPath extends EntryRecordPath<TRecord>>(path: TPath) => IconEntry.make<TRecord, TPath>(path),
    image: <const TPath extends RecordPathFor<TRecord, string>>(path: TPath) => ImageEntry.make<TRecord, TPath>(path),
    keyValue: <const TPath extends EntryRecordPath<TRecord>>(path: TPath) => KeyValueEntry.make<TRecord, TPath>(path),
    repeatable: <const TPath extends EntryRecordPath<TRecord>>(path: TPath) => RepeatableEntry.make<TRecord, TPath>(path),
    text: <const TPath extends EntryRecordPath<TRecord>>(path: TPath) => TextEntry.make<TRecord, TPath>(path),
  })
}
