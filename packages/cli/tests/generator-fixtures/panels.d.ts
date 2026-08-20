declare module '@holo-js/panels-resources' {
  type Component = { compile(): object }
  type ModelSource = {
    create(...parameters: never[]): object | Promise<object>
    readonly definition: {
      readonly name: string
      readonly primaryKey: string
      readonly relations?: Readonly<Record<string, unknown>>
      readonly softDeletes: boolean
    }
    query(): object
  }
  type RecordFor<TModel extends ModelSource> = Awaited<ReturnType<TModel['create']>>
  type RecordPath<TRecord extends object> = string extends keyof TRecord ? string : Extract<keyof TRecord, string>

  type FieldBuilder = Component & {
    numeric(): FieldBuilder
    required(): FieldBuilder
  }

  type ColumnBuilder = Component & {
    dateTime(): ColumnBuilder
    number(): ColumnBuilder
  }

  type TableAction = {
    compile(): object
    manifest(scope?: 'bulk' | 'header' | 'notification' | 'record' | 'row'): object
  }

  type FieldFactory<TRecord extends object> = {
    checkbox<TPath extends RecordPath<TRecord>>(path: TPath): FieldBuilder
    dateTimePicker<TPath extends RecordPath<TRecord>>(path: TPath): FieldBuilder
    textInput<TPath extends RecordPath<TRecord>>(path: TPath): FieldBuilder
  }

  type ColumnFactory<TRecord extends object> = {
    text<TPath extends RecordPath<TRecord>>(path: TPath): ColumnBuilder
  }

  type ActionFactory = {
    create(): TableAction
    delete(): TableAction
    deleteBulk(): TableAction
    edit(): TableAction
    group(actions: readonly TableAction[]): TableAction
    view(): TableAction
  }

  class Schema<TRecord extends object> {
    components(configure: (field: FieldFactory<TRecord>) => readonly Component[]): this
  }

  class Table<TRecord extends object> {
    columns(configure: (column: ColumnFactory<TRecord>) => readonly Component[]): this
    recordActions(configure: (action: ActionFactory) => readonly TableAction[]): this
    toolbarActions(configure: (action: ActionFactory) => readonly TableAction[]): this
  }

  type SchemaConfiguration = (schema: Schema<object>) => Schema<object>
  type TableConfiguration = (table: Table<object>) => Table<object>

  export class Resource {
    protected static model: ModelSource
    static actions(configure: (action: ActionFactory) => readonly TableAction[]): readonly TableAction[]
    protected static configureForm(configuration: (schema: Schema<Record<string, unknown>>) => Schema<Record<string, unknown>>): SchemaConfiguration
    protected static configureTable(configuration: (table: Table<Record<string, unknown>>) => Table<Record<string, unknown>>): TableConfiguration
  }

  export function configureResourceForm<TModel extends ModelSource>(
    model: TModel,
    configuration: (schema: Schema<RecordFor<TModel>>) => Schema<RecordFor<TModel>>,
  ): SchemaConfiguration

  export function configureResourceTable<TModel extends ModelSource>(
    model: TModel,
    configuration: (table: Table<RecordFor<TModel>>) => Table<RecordFor<TModel>>,
  ): TableConfiguration

  class ResourcePage {
    static get resource(): object
    static route(path: string): { readonly pageType: 'create' | 'edit' | 'list' | 'view', readonly path: string }
    protected getHeaderActions(): readonly TableAction[]
  }

  export class CreateRecord extends ResourcePage {}
  export class EditRecord extends ResourcePage {}
  export class ListRecords extends ResourcePage {}
  export class ViewRecord extends ResourcePage {}
  export class Page extends ResourcePage {}

  export class RelationManager {
    protected static relationship: string
    protected static configureTable(configuration: (table: Table<Record<string, unknown>>) => Table<Record<string, unknown>>): TableConfiguration
  }
}
