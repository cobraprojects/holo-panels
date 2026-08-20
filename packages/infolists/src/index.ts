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
} from '@holo-js/panels-core'
import { Schema } from '@holo-js/panels-schemas'

export class Infolist<TRecord extends object = Record<string, unknown>> extends Schema<TRecord> {}

export class TextEntry<TRecord extends object = Record<string, unknown>, TPath extends EntryRecordPath<TRecord> = EntryRecordPath<TRecord>> extends CoreTextEntry<TRecord, TPath> {
  static make<TRecord extends object = Record<string, unknown>, TPath extends EntryRecordPath<TRecord> = EntryRecordPath<TRecord>>(path: TPath): TextEntry<TRecord, TPath> { return new TextEntry(path) }
}

export class IconEntry<TRecord extends object = Record<string, unknown>, TPath extends EntryRecordPath<TRecord> = EntryRecordPath<TRecord>> extends CoreIconEntry<TRecord, TPath> {
  static make<TRecord extends object = Record<string, unknown>, TPath extends EntryRecordPath<TRecord> = EntryRecordPath<TRecord>>(path: TPath): IconEntry<TRecord, TPath> { return new IconEntry(path) }
}

export class ImageEntry<TRecord extends object = Record<string, unknown>, TPath extends RecordPathFor<TRecord, string> = RecordPathFor<TRecord, string>> extends CoreImageEntry<TRecord, TPath> {
  static make<TRecord extends object = Record<string, unknown>, TPath extends RecordPathFor<TRecord, string> = RecordPathFor<TRecord, string>>(path: TPath): ImageEntry<TRecord, TPath> { return new ImageEntry(path) }
}

export class ColorEntry<TRecord extends object = Record<string, unknown>, TPath extends RecordPathFor<TRecord, string> = RecordPathFor<TRecord, string>> extends CoreColorEntry<TRecord, TPath> {
  static make<TRecord extends object = Record<string, unknown>, TPath extends RecordPathFor<TRecord, string> = RecordPathFor<TRecord, string>>(path: TPath): ColorEntry<TRecord, TPath> { return new ColorEntry(path) }
}

export class CodeEntry<TRecord extends object = Record<string, unknown>, TPath extends EntryRecordPath<TRecord> = EntryRecordPath<TRecord>> extends CoreCodeEntry<TRecord, TPath> {
  static make<TRecord extends object = Record<string, unknown>, TPath extends EntryRecordPath<TRecord> = EntryRecordPath<TRecord>>(path: TPath): CodeEntry<TRecord, TPath> { return new CodeEntry(path) }
}

export class KeyValueEntry<TRecord extends object = Record<string, unknown>, TPath extends EntryRecordPath<TRecord> = EntryRecordPath<TRecord>> extends CoreKeyValueEntry<TRecord, TPath> {
  static make<TRecord extends object = Record<string, unknown>, TPath extends EntryRecordPath<TRecord> = EntryRecordPath<TRecord>>(path: TPath): KeyValueEntry<TRecord, TPath> { return new KeyValueEntry(path) }
}

export class RepeatableEntry<TRecord extends object = Record<string, unknown>, TPath extends EntryRecordPath<TRecord> = EntryRecordPath<TRecord>> extends CoreRepeatableEntry<TRecord, TPath> {
  static make<TRecord extends object = Record<string, unknown>, TPath extends EntryRecordPath<TRecord> = EntryRecordPath<TRecord>>(path: TPath): RepeatableEntry<TRecord, TPath> { return new RepeatableEntry(path) }
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
