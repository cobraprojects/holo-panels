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

  class Schema<TRecord extends object> {
    components(components: readonly Component[]): this
  }

  class Table<TRecord extends object> {
    columns(columns: readonly Component[]): this
    recordActions(actions: readonly TableAction[]): this
    toolbarActions(actions: readonly TableAction[]): this
  }

  type SchemaConfiguration = (schema: Schema<object>) => Schema<object>
  type TableConfiguration = (table: Table<object>) => Table<object>

  export class Resource {
    protected static model: ModelSource
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

declare module '@holo-js/panels-actions' {
  type TableAction = {
    compile(): object
    manifest(scope?: 'bulk' | 'header' | 'notification' | 'record' | 'row'): object
  }
  type ActionFactory = { make(): TableAction }
  export const CreateAction: ActionFactory
  export const DeleteAction: ActionFactory
  export const DeleteBulkAction: ActionFactory
  export const EditAction: ActionFactory
  export const ViewAction: ActionFactory
  export const ActionGroup: { make(actions: readonly TableAction[]): TableAction }
}

declare module '@holo-js/panels-forms' {
  type FieldBuilder = {
    compile(): object
    numeric(): FieldBuilder
    required(): FieldBuilder
  }
  type FieldFactory = { make(path: string): FieldBuilder }
  export const Checkbox: FieldFactory
  export const DateTimePicker: FieldFactory
  export const TextInput: FieldFactory
}

declare module '@holo-js/panels-tables' {
  type ColumnBuilder = {
    compile(): object
    dateTime(): ColumnBuilder
    number(): ColumnBuilder
  }
  export const TextColumn: { make(path: string): ColumnBuilder }
}
