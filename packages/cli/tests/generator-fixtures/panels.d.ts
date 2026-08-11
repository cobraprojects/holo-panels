declare module '@holo-js/panels' {
  type PathFor<TRecord, TValue> = {
    [TKey in keyof TRecord & string]: NonNullable<TRecord[TKey]> extends TValue ? TKey : never
  }[keyof TRecord & string]

  type FieldBuilder<TKey extends string> = {
    readonly path: TKey
    numeric(): FieldBuilder<TKey>
    required(): FieldBuilder<TKey>
  }

  type ColumnBuilder<TKey extends string> = {
    readonly path: TKey
    dateTime(): ColumnBuilder<TKey>
    number(): ColumnBuilder<TKey>
  }

  type FieldFactory<TRecord> = {
    checkbox<TKey extends PathFor<TRecord, boolean>>(key: TKey): FieldBuilder<TKey>
    dateTime<TKey extends PathFor<TRecord, Date>>(key: TKey): FieldBuilder<TKey>
    text<TKey extends PathFor<TRecord, number | string>>(key: TKey): FieldBuilder<TKey>
  }

  type ColumnFactory<TRecord> = {
    boolean<TKey extends PathFor<TRecord, boolean>>(key: TKey): ColumnBuilder<TKey>
    text<TKey extends keyof TRecord & string>(key: TKey): ColumnBuilder<TKey>
  }

  type Resource<TRecord> = {
    form(schema: Schema<TRecord>): Resource<TRecord>
    table(table: Table<TRecord>): Resource<TRecord>
  }

  type Schema<TRecord> = {
    readonly definitionKind: 'schema'
    fields<TFields extends readonly FieldBuilder<string>[]>(configure: (field: FieldFactory<TRecord>) => TFields): Schema<TRecord>
  }

  type Table<TRecord> = {
    readonly definitionKind: 'table'
    columns<TColumns extends readonly ColumnBuilder<string>[]>(configure: (column: ColumnFactory<TRecord>) => TColumns): Table<TRecord>
  }

  export function defineResource<TRecord>(model: abstract new () => TRecord): Resource<TRecord>
  export function defineRelationManager<TRecord>(id: string, model: abstract new () => TRecord): { readonly record?: TRecord }
  export function defineSchema<TRecord>(model: abstract new () => TRecord): Schema<TRecord>
  export function defineTable<TRecord>(model: abstract new () => TRecord): Table<TRecord>
}
