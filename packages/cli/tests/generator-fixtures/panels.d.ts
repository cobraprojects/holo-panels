declare module '@holo-js/panels' {
  type Descriptor<TKey extends string> = { readonly key: TKey }
  type Checked<TRecord, TDescriptor> = TDescriptor extends Descriptor<infer TKey>
    ? TKey extends Extract<keyof TRecord, string>
      ? TDescriptor
      : never
    : never
  type CheckedList<TRecord, TDescriptors extends readonly Descriptor<string>[]> = {
    readonly [TIndex in keyof TDescriptors]: Checked<TRecord, TDescriptors[TIndex]>
  }
  type Resource<TRecord> = {
    shared(): Resource<TRecord>
    form(schema: Schema<TRecord>): Resource<TRecord>
    form<const TDescriptors extends readonly Descriptor<string>[]>(descriptors: TDescriptors & CheckedList<TRecord, TDescriptors>): Resource<TRecord>
    table(table: Table<TRecord>): Resource<TRecord>
    table<const TDescriptors extends readonly Descriptor<string>[]>(descriptors: TDescriptors & CheckedList<TRecord, TDescriptors>): Resource<TRecord>
  }
  type Schema<TRecord> = {
    readonly definitionKind: 'schema'
    fields<const TDescriptors extends readonly Descriptor<string>[]>(descriptors: TDescriptors & CheckedList<TRecord, TDescriptors>): Schema<TRecord>
  }
  type Table<TRecord> = {
    readonly definitionKind: 'table'
    columns<const TDescriptors extends readonly Descriptor<string>[]>(descriptors: TDescriptors & CheckedList<TRecord, TDescriptors>): Table<TRecord>
  }

  export const column: {
    boolean<TKey extends string>(key: TKey): Descriptor<TKey>
    dateTime<TKey extends string>(key: TKey): Descriptor<TKey>
    number<TKey extends string>(key: TKey): Descriptor<TKey>
    text<TKey extends string>(key: TKey): Descriptor<TKey>
  }
  export function defineResource<TRecord>(model: abstract new () => TRecord): Resource<TRecord>
  export function defineRelationManager<TRecord>(id: string, model: abstract new () => TRecord): { readonly record?: TRecord }
  export function defineSchema<TRecord>(model: abstract new () => TRecord): Schema<TRecord>
  export function defineTable<TRecord>(model: abstract new () => TRecord): Table<TRecord>
  export const field: {
    boolean<TKey extends string>(key: TKey): Descriptor<TKey> & { required(): Descriptor<TKey> }
    dateTime<TKey extends string>(key: TKey): Descriptor<TKey> & { required(): Descriptor<TKey> }
    number<TKey extends string>(key: TKey): Descriptor<TKey> & { required(): Descriptor<TKey> }
    text<TKey extends string>(key: TKey): Descriptor<TKey> & { required(): Descriptor<TKey> }
  }
}
