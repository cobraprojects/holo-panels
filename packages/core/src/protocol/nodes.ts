import type { JsonObject } from './json'
import type { SourceLocation } from './source-location'

export type NodeKind =
  | 'action'
  | 'column'
  | 'entry'
  | 'export'
  | 'field'
  | 'filter'
  | 'import'
  | 'layout'
  | 'navigation'
  | 'notification'
  | 'page'
  | 'panel'
  | 'resource'
  | 'schema'
  | 'summary'
  | 'table'
  | 'widget'

export interface ClientRegistryReference {
  name: string
  namespace: string
  typeId: string
}

export interface ServerHandles {
  actions?: Readonly<Record<string, (...parameters: never[]) => object | Promise<object>>>
  resolvers?: Readonly<Record<string, (...parameters: never[]) => object | Promise<object>>>
}

interface BasePublicNode<TKind extends NodeKind, TProperties extends JsonObject> {
  client?: ClientRegistryReference
  id: string
  kind: TKind
  properties: TProperties
  protocolVersion: string
  type: string
}

export interface PanelProperties extends JsonObject {
  path: string
}

export interface PageProperties extends JsonObject {
  route: string
}

export interface ResourceProperties extends JsonObject {
  model: string
}

export interface SchemaProperties extends JsonObject {
  componentIds: string[]
}

export interface LayoutProperties extends JsonObject {
  children: string[]
}

export interface FieldProperties extends JsonObject {
  path: string
}

export interface EntryProperties extends JsonObject {
  path: string
}

export interface TableProperties extends JsonObject {
  columnIds: string[]
}

export interface ColumnProperties extends JsonObject {
  path: string
}

export interface FilterProperties extends JsonObject {
  name: string
}

export interface SummaryProperties extends JsonObject {
  columnId: string
}

export interface ActionProperties extends JsonObject {
  name: string
}

export interface WidgetProperties extends JsonObject {
  name: string
}

export interface NavigationProperties extends JsonObject {
  targetId: string
}

export interface NotificationProperties extends JsonObject {
  title: string
}

export interface ImportProperties extends JsonObject {
  resourceId: string
}

export interface ExportProperties extends JsonObject {
  resourceId: string
}

export type PanelNode = BasePublicNode<'panel', PanelProperties>
export type PageNode = BasePublicNode<'page', PageProperties>
export type ResourceNode = BasePublicNode<'resource', ResourceProperties>
export type SchemaNode = BasePublicNode<'schema', SchemaProperties>
export type LayoutNode = BasePublicNode<'layout', LayoutProperties>
export type FieldNode = BasePublicNode<'field', FieldProperties>
export type EntryNode = BasePublicNode<'entry', EntryProperties>
export type TableNode = BasePublicNode<'table', TableProperties>
export type ColumnNode = BasePublicNode<'column', ColumnProperties>
export type FilterNode = BasePublicNode<'filter', FilterProperties>
export type SummaryNode = BasePublicNode<'summary', SummaryProperties>
export type ActionNode = BasePublicNode<'action', ActionProperties>
export type WidgetNode = BasePublicNode<'widget', WidgetProperties>
export type NavigationNode = BasePublicNode<'navigation', NavigationProperties>
export type NotificationNode = BasePublicNode<'notification', NotificationProperties>
export type ImportNode = BasePublicNode<'import', ImportProperties>
export type ExportNode = BasePublicNode<'export', ExportProperties>

export type PublicNode =
  | ActionNode
  | ColumnNode
  | EntryNode
  | ExportNode
  | FieldNode
  | FilterNode
  | ImportNode
  | LayoutNode
  | NavigationNode
  | NotificationNode
  | PageNode
  | PanelNode
  | ResourceNode
  | SchemaNode
  | SummaryNode
  | TableNode
  | WidgetNode

export interface CompiledNode<TNode extends PublicNode = PublicNode> {
  public: TNode
  server: ServerHandles
  source?: SourceLocation
}
