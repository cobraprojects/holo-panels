import {
  ActionsRenderHook,
  type ActionContext as CoreActionContext,
  type ActionPresentationContext as CoreActionPresentationContext,
  type ActionDefinition,
  type ActionKind,
  type ActionModalWidth,
  type ActionMount,
  type ActionResolvable,
  type ActionSize,
  builtInActionPresentation,
  type JsonObject,
  type PanelNotificationPresentation,
  type RegisteredPanelRecord,
  toJsonValue,
} from '@holo-js/panels-core'

export { ActionsRenderHook }
import { compileSchemaComponentManifest, Schema, type SchemaComponentContract, type SchemaComponentFor } from '@holo-js/panels-schemas'

function actionSchema(schema: { compile(): object, getComponents(): readonly SchemaComponentContract[] } | null): JsonObject | null {
  if (!schema) return null
  const value = toJsonValue({ ...schema.compile(), fields: schema.getComponents().map(compileSchemaComponentManifest) })
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Action schemas must compile to an object')
  return value
}

export type ActionColor = 'danger' | 'gray' | 'info' | 'primary' | 'success' | 'warning' | string
export type ActionAlignment = 'center' | 'end' | 'start'
export type ActionButtonStyle = 'button' | 'grouped' | 'icon' | 'link'

export interface ActionContext<
  TRecord extends object = object,
  TData extends object = object,
  TActor extends object = object,
  TTenant = unknown,
  TServices = object,
> extends CoreActionContext<TRecord, TActor, TTenant, TServices> {
  readonly data: Readonly<TData>
  readonly selectedRecordIds: readonly (number | string)[]
  readonly selectedRecords: readonly TRecord[]
}

type Resolvable<TContext, TValue> = TValue | ((context: TContext) => TValue | Promise<TValue>)

export interface ActionPresentationContext<
  TRecord extends object = object,
  TData extends object = object,
  TActor extends object = object,
  TTenant = unknown,
  TServices = object,
> extends CoreActionPresentationContext<TRecord, TData, TActor, TTenant, TServices> {
  readonly selectedRecords: readonly TRecord[]
}
type ActionHandler<TContext, TData extends object, TResult> = (data: Readonly<TData>, context: TContext) => TResult | Promise<TResult>

export interface ActionContract<TRecord extends object = object> {
  readonly id: string
  readonly resourceRecordType: TRecord
  compile(): object
  manifest(scope?: 'bulk' | 'header' | 'notification' | 'record' | 'row'): JsonObject
}

interface ActionModalState<TRecord extends object, TData extends object, TActor extends object, TTenant, TServices, TSchemaFactory> {
  alignment: ActionAlignment
  autofocus: boolean
  cancelActionLabel: string | null
  closeByClickingAway: boolean
  closeByEscaping: boolean
  content: JsonObject | null
  description: Resolvable<ActionPresentationContext<TRecord, TData, TActor, TTenant, TServices>, string | null>
  footer: JsonObject | null
  heading: Resolvable<ActionPresentationContext<TRecord, TData, TActor, TTenant, TServices>, string | null>
  icon: string | null
  iconColor: ActionColor | null
  nestedActions: readonly ActionContract<TRecord>[]
  schema: Schema<TRecord, TData, TSchemaFactory> | null
  slideOver: boolean
  stickyFooter: boolean
  stickyHeader: boolean
  submitActionLabel: string | null
  width: ActionModalWidth
}

function headline(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/gu, '$1 $2')
    .replace(/[._-]+/gu, ' ')
    .replace(/\b\w/gu, character => character.toUpperCase())
}

function literal<TContext, TValue>(value: Resolvable<TContext, TValue>): TValue | null {
  return typeof value === 'function' ? null : value
}

const compilingActions = new Set<object>()

export class Action<
  TRecord extends object = RegisteredPanelRecord,
  TData extends object = object,
  TResult = void,
  TActor extends object = object,
  TTenant = unknown,
  TServices = object,
  TSchemaFactory = undefined,
> implements ActionContract<TRecord> {
  declare readonly resourceRecordType: TRecord
  declare readonly actionDataType: TData
  declare readonly actionResultType: TResult
  readonly id: string
  readonly kind: ActionKind
  readonly mount: ActionMount
  #authorize: (context: ActionContext<TRecord, TData, TActor, TTenant, TServices>) => boolean | Promise<boolean> = () => true
  #badge: Resolvable<ActionPresentationContext<TRecord, TData, TActor, TTenant, TServices>, string | null> = null
  #buttonStyle: ActionButtonStyle = 'button'
  #color: Resolvable<ActionPresentationContext<TRecord, TData, TActor, TTenant, TServices>, ActionColor | null> = null
  #confirmation: string | null = null
  #disabled: Resolvable<ActionPresentationContext<TRecord, TData, TActor, TTenant, TServices>, boolean> = false
  #extraAttributes: JsonObject = {}
  #failureNotification: PanelNotificationPresentation | null = null
  #groupedIcon: string | null = null
  #handler: ActionHandler<ActionContext<TRecord, TData, TActor, TTenant, TServices>, TData, TResult>
  #icon: Resolvable<ActionPresentationContext<TRecord, TData, TActor, TTenant, TServices>, string | null> = null
  #iconPosition: 'after' | 'before' = 'before'
  #label: Resolvable<ActionPresentationContext<TRecord, TData, TActor, TTenant, TServices>, string>
  #modal: ActionModalState<TRecord, TData, TActor, TTenant, TServices, TSchemaFactory> | null = null
  #requiresConfirmation = false
  #size: ActionSize = 'medium'
  #successNotification: PanelNotificationPresentation | null = null
  #tooltip: Resolvable<ActionPresentationContext<TRecord, TData, TActor, TTenant, TServices>, string | null> = null
  #url: Resolvable<ActionPresentationContext<TRecord, TData, TActor, TTenant, TServices>, string | null> = null
  #urlInNewTab = false
  #usesDefaultHandler = true
  #visible: Resolvable<ActionPresentationContext<TRecord, TData, TActor, TTenant, TServices>, boolean> = true
  readonly #schemaFactory: TSchemaFactory | undefined

  constructor(id: string, kind: ActionKind = 'custom', mount: ActionMount = 'record', schemaFactory?: TSchemaFactory) {
    this.id = id
    this.kind = kind
    this.mount = mount
    this.#label = headline(id)
    this.#handler = (() => undefined) as unknown as ActionHandler<ActionContext<TRecord, TData, TActor, TTenant, TServices>, TData, TResult>
    this.#schemaFactory = schemaFactory
  }

  static make<
    TRecord extends object = RegisteredPanelRecord,
    TData extends object = object,
    TResult = void,
    TActor extends object = object,
    TTenant = unknown,
    TServices = object,
  >(name: string): Action<TRecord, TData, TResult, TActor, TTenant, TServices> {
    return new Action(name)
  }

  action<TNextResult>(handler: ActionHandler<ActionContext<TRecord, TData, TActor, TTenant, TServices>, TData, TNextResult>): Action<TRecord, TData, TNextResult, TActor, TTenant, TServices, TSchemaFactory> {
    this.#usesDefaultHandler = false
    this.#handler = handler as ActionHandler<ActionContext<TRecord, TData, TActor, TTenant, TServices>, TData, TResult>
    return this as unknown as Action<TRecord, TData, TNextResult, TActor, TTenant, TServices, TSchemaFactory>
  }

  authorize(callback: (context: ActionContext<TRecord, TData, TActor, TTenant, TServices>) => boolean | Promise<boolean>): this {
    this.#authorize = callback
    return this
  }

  badge(value: Resolvable<ActionPresentationContext<TRecord, TData, TActor, TTenant, TServices>, string | null>): this {
    this.#badge = value
    return this
  }

  button(): this {
    this.#buttonStyle = 'button'
    return this
  }

  link(): this {
    this.#buttonStyle = 'link'
    return this
  }

  iconButton(): this {
    this.#buttonStyle = 'icon'
    return this
  }

  grouped(): this {
    this.#buttonStyle = 'grouped'
    return this
  }

  color(value: Resolvable<ActionPresentationContext<TRecord, TData, TActor, TTenant, TServices>, ActionColor | null>): this {
    this.#color = value
    return this
  }

  disabled(value: Resolvable<ActionPresentationContext<TRecord, TData, TActor, TTenant, TServices>, boolean> = true): this {
    this.#disabled = value
    return this
  }

  extraAttributes(attributes: Readonly<Record<string, unknown>>): this {
    const value = toJsonValue(attributes)
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Action attributes must be a JSON-safe object')
    this.#extraAttributes = value
    return this
  }

  failureNotification(notification: PanelNotificationPresentation | null): this {
    this.#failureNotification = notification
    return this
  }

  icon(value: Resolvable<ActionPresentationContext<TRecord, TData, TActor, TTenant, TServices>, string | null>): this {
    this.#icon = value
    return this
  }

  groupedIcon(value: string | null): this {
    this.#groupedIcon = value
    return this
  }

  iconPosition(position: 'after' | 'before'): this {
    this.#iconPosition = position
    return this
  }

  label(value: Resolvable<ActionPresentationContext<TRecord, TData, TActor, TTenant, TServices>, string>): this {
    this.#label = value
    return this
  }

  modalAlignment(alignment: ActionAlignment): this {
    this.modal().alignment = alignment
    return this
  }

  modalAutofocus(value = true): this {
    this.modal().autofocus = value
    return this
  }

  modalCancelActionLabel(label: string | null): this {
    this.modal().cancelActionLabel = label
    return this
  }

  modalCloseButton(value = true): this {
    this.modal().closeByEscaping = value
    return this
  }

  closeModalByClickingAway(value = true): this {
    this.modal().closeByClickingAway = value
    return this
  }

  closeModalByEscaping(value = true): this {
    this.modal().closeByEscaping = value
    return this
  }

  modalContent(content: JsonObject | null): this {
    this.modal().content = content
    return this
  }

  modalDescription(value: Resolvable<ActionPresentationContext<TRecord, TData, TActor, TTenant, TServices>, string | null>): this {
    this.modal().description = value
    return this
  }

  modalFooter(content: JsonObject | null): this {
    this.modal().footer = content
    return this
  }

  modalHeading(value: Resolvable<ActionPresentationContext<TRecord, TData, TActor, TTenant, TServices>, string | null>): this {
    this.modal().heading = value
    return this
  }

  modalIcon(icon: string | null): this {
    this.modal().icon = icon
    return this
  }

  modalIconColor(color: ActionColor | null): this {
    this.modal().iconColor = color
    return this
  }

  modalSubmitActionLabel(label: string | null): this {
    this.modal().submitActionLabel = label
    return this
  }

  modalWidth(width: ActionModalWidth): this {
    this.modal().width = width
    return this
  }

  registerModalActions(actions: readonly ActionContract<TRecord>[]): this {
    this.modal().nestedActions = Object.freeze([...actions])
    return this
  }

  requiresConfirmation(value: boolean | string = true): this {
    this.#requiresConfirmation = value !== false
    this.#confirmation = typeof value === 'string' ? value : value ? 'Are you sure?' : null
    return this
  }

  schema(schema: readonly SchemaComponentFor<TRecord>[]): this
  schema<const TComponents extends readonly SchemaComponentContract<TRecord>[]>(schema: Schema<TRecord, TData, TSchemaFactory> | ((factory: TSchemaFactory) => TComponents)): this
  schema<const TComponents extends readonly SchemaComponentContract<TRecord>[]>(
    schema: readonly SchemaComponentFor<TRecord>[] | Schema<TRecord, TData, TSchemaFactory> | ((factory: TSchemaFactory) => TComponents),
  ): this {
    if (schema instanceof Schema) {
      this.modal().schema = schema
      return this
    }
    const factory = this.#schemaFactory
    if (typeof schema !== 'function') {
      this.modal().schema = new Schema<TRecord, TData, TSchemaFactory>().components(schema)
      return this
    }
    if (factory === undefined) throw new Error('Action schema callbacks require a component factory')
    this.modal().schema = new Schema<TRecord, TData, TSchemaFactory>().components(schema(factory))
    return this
  }

  size(size: ActionSize): this {
    this.#size = size
    return this
  }

  slideOver(value = true): this {
    this.modal().slideOver = value
    return this
  }

  stickyModalFooter(value = true): this {
    this.modal().stickyFooter = value
    return this
  }

  stickyModalHeader(value = true): this {
    this.modal().stickyHeader = value
    return this
  }

  successNotification(notification: PanelNotificationPresentation | null): this {
    this.#successNotification = notification
    return this
  }

  tooltip(value: Resolvable<ActionPresentationContext<TRecord, TData, TActor, TTenant, TServices>, string | null>): this {
    this.#tooltip = value
    return this
  }

  url(value: Resolvable<ActionPresentationContext<TRecord, TData, TActor, TTenant, TServices>, string | null>, shouldOpenInNewTab = false): this {
    this.#url = value
    this.#urlInNewTab = shouldOpenInNewTab
    return this
  }

  openUrlInNewTab(value = true): this {
    this.#urlInNewTab = value
    return this
  }

  visible(value: Resolvable<ActionPresentationContext<TRecord, TData, TActor, TTenant, TServices>, boolean> = true): this {
    this.#visible = value
    return this
  }

  hidden(value: Resolvable<ActionPresentationContext<TRecord, TData, TActor, TTenant, TServices>, boolean> = true): this {
    this.#visible = typeof value === 'function' ? async context => !await value(context) : !value
    return this
  }

  manifest(scope: 'bulk' | 'header' | 'notification' | 'record' | 'row' = 'record'): JsonObject {
    const modal = this.#modal
    return {
      badge: literal(this.#badge),
      buttonStyle: this.#buttonStyle,
      color: literal(this.#color),
      confirmation: this.#confirmation,
      disabled: typeof this.#disabled === 'boolean' ? this.#disabled : false,
      extraAttributes: this.#extraAttributes,
      groupedIcon: this.#groupedIcon,
      icon: literal(this.#icon),
      iconPosition: this.#iconPosition,
      id: this.id,
      kind: this.kind,
      label: typeof this.#label === 'string' ? this.#label : headline(this.id),
      modal: modal ? {
        alignment: modal.alignment,
        autofocus: modal.autofocus,
        cancelActionLabel: modal.cancelActionLabel,
        closeByClickingAway: modal.closeByClickingAway,
        closeByEscaping: modal.closeByEscaping,
        content: modal.content,
        description: literal(modal.description),
        footer: modal.footer,
        heading: literal(modal.heading),
        icon: modal.icon,
        iconColor: modal.iconColor,
        nestedActions: modal.nestedActions.map(action => action.id),
        schema: actionSchema(modal.schema),
        slideOver: modal.slideOver,
        stickyFooter: modal.stickyFooter,
        stickyHeader: modal.stickyHeader,
        submitActionLabel: modal.submitActionLabel,
        width: modal.width,
      } : null,
      mount: scope === 'bulk' ? 'bulk' : scope === 'notification' ? 'notification' : scope === 'header' ? 'page' : this.mount,
      removesRecord: this.kind === 'delete' || this.kind === 'force-delete',
      requiresConfirmation: this.#requiresConfirmation,
      scope,
      size: this.#size,
      tooltip: literal(this.#tooltip),
      type: this.kind,
      url: literal(this.#url),
      urlInNewTab: this.#urlInNewTab,
      visible: typeof this.#visible === 'boolean' ? this.#visible : true,
    }
  }

  compile(): Readonly<ActionDefinition<TRecord, TData & JsonObject, TResult, TActor, TTenant, TServices>> {
    if (compilingActions.has(this) || compilingActions.size >= 10) throw new Error('Nested actions must be acyclic and cannot exceed ten levels')
    compilingActions.add(this)
    try {
    return Object.freeze({
      authorize: (context: CoreActionContext<TRecord, TActor, TTenant, TServices>, data: Readonly<TData & JsonObject>) => this.#authorize(this.executionContext(data, context)),
      badge: this.coreResolver(this.#badge),
      color: this.coreResolver(this.#color),
      confirmation: this.#confirmation,
      disabled: this.coreResolver(this.#disabled),
      failureNotification: this.#failureNotification ?? undefined,
      handle: (data: TData & JsonObject, context: CoreActionContext<TRecord, TActor, TTenant, TServices>) => this.#handler(data, this.executionContext(data, context)),
      icon: this.coreResolver(this.#icon),
      id: this.id,
      kind: this.kind,
      label: this.coreResolver(this.#label),
      modal: this.compiledModal(),
      nestedActions: this.#modal?.nestedActions.map(action => action.compile()),
      mount: this.mount,
      successNotification: this.#successNotification ?? undefined,
      size: this.#size,
      tooltip: this.coreResolver(this.#tooltip),
      visible: this.coreResolver(this.#visible),
      usesDefaultHandler: this.#usesDefaultHandler,
      url: this.coreResolver(this.#url),
      urlInNewTab: this.#urlInNewTab,
    })
    } finally {
      compilingActions.delete(this)
    }
  }

  private compiledModal(): ActionDefinition<TRecord, TData & JsonObject, TResult, TActor, TTenant, TServices>['modal'] {
    const modal = this.#modal
    if (!modal) return undefined
    const schema = actionSchema(modal.schema)
    if (schema !== null && (Array.isArray(schema) || typeof schema !== 'object')) throw new TypeError('Action modal schemas must serialize to JSON objects')
    return Object.freeze({
      alignment: modal.alignment,
      autofocus: modal.autofocus,
      cancelActionLabel: modal.cancelActionLabel,
      closeByClickingAway: modal.closeByClickingAway,
      closeByEscaping: modal.closeByEscaping,
      content: modal.content ?? undefined,
      description: this.coreResolver(modal.description),
      footer: modal.footer ?? undefined,
      heading: this.coreResolver(modal.heading),
      icon: modal.icon,
      iconColor: modal.iconColor,
      nestedActions: Object.freeze(modal.nestedActions.map(action => action.id)),
      schema: schema ?? undefined,
      slideOver: modal.slideOver,
      stickyFooter: modal.stickyFooter,
      stickyHeader: modal.stickyHeader,
      submitActionLabel: modal.submitActionLabel,
      width: modal.width,
    })
  }

  private coreResolver<TValue>(
    value: Resolvable<ActionPresentationContext<TRecord, TData, TActor, TTenant, TServices>, TValue>,
  ): ActionResolvable<CoreActionPresentationContext<TRecord, TData & JsonObject, TActor, TTenant, TServices>, TValue> {
    if (typeof value !== 'function') return value
    const resolve = value as (context: ActionPresentationContext<TRecord, TData, TActor, TTenant, TServices>) => TValue | Promise<TValue>
    return context => resolve(Object.freeze({
      ...context,
      selectedRecords: context.selectedRecords ?? Object.freeze(context.record ? [context.record] : []),
    }))
  }

  private executionContext(data: Readonly<TData>, context: CoreActionContext<TRecord, TActor, TTenant, TServices>): ActionContext<TRecord, TData, TActor, TTenant, TServices> {
    return Object.freeze({
      ...context,
      data,
      selectedRecordIds: context.selectedRecordIds ?? Object.freeze([]),
      selectedRecords: context.selectedRecords ?? Object.freeze(context.record ? [context.record] : []),
    })
  }

  private modal(): ActionModalState<TRecord, TData, TActor, TTenant, TServices, TSchemaFactory> {
    this.#modal ??= {
      alignment: 'center',
      autofocus: true,
      cancelActionLabel: null,
      closeByClickingAway: true,
      closeByEscaping: true,
      content: null,
      description: null,
      footer: null,
      heading: null,
      icon: null,
      iconColor: null,
      nestedActions: [],
      schema: null,
      slideOver: false,
      stickyFooter: false,
      stickyHeader: false,
      submitActionLabel: null,
      width: 'medium',
    }
    return this.#modal
  }
}

export class BulkAction<
  TRecord extends object = RegisteredPanelRecord,
  TData extends object = object,
  TResult = void,
  TActor extends object = object,
  TTenant = unknown,
  TServices = object,
  TSchemaFactory = undefined,
> extends Action<TRecord, TData, TResult, TActor, TTenant, TServices, TSchemaFactory> {
  #chunkSize: number | undefined
  #deselectAfterCompletion = false
  #fetchRecords = true

  override action<TNextResult>(handler: ActionHandler<ActionContext<TRecord, TData, TActor, TTenant, TServices>, TData, TNextResult>): BulkAction<TRecord, TData, TNextResult, TActor, TTenant, TServices, TSchemaFactory> & Omit<this, keyof BulkAction<TRecord, TData, TResult, TActor, TTenant, TServices, TSchemaFactory>> {
    return super.action(handler) as BulkAction<TRecord, TData, TNextResult, TActor, TTenant, TServices, TSchemaFactory> & Omit<this, keyof BulkAction<TRecord, TData, TResult, TActor, TTenant, TServices, TSchemaFactory>>
  }

  chunkSelectedRecords(size: number): this {
    if (!Number.isSafeInteger(size) || size < 1 || size > 1000) throw new Error('Bulk chunk sizes must be integers from 1 to 1000')
    this.#chunkSize = size
    return this
  }

  deselectRecordsAfterCompletion(value = true): this {
    this.#deselectAfterCompletion = value
    return this
  }

  fetchSelectedRecords(value = true): this {
    this.#fetchRecords = value
    return this
  }

  override compile(): Readonly<ActionDefinition<TRecord, TData & JsonObject, TResult, TActor, TTenant, TServices>> {
    return Object.freeze({ ...super.compile(), bulk: Object.freeze({ chunkSize: this.#chunkSize, deselectAfterCompletion: this.#deselectAfterCompletion, fetchRecords: this.#fetchRecords }) })
  }

  override manifest(scope: 'bulk' | 'header' | 'notification' | 'record' | 'row' = 'bulk'): JsonObject {
    return { ...super.manifest(scope), deselectAfterCompletion: this.#deselectAfterCompletion }
  }

  constructor(id: string, kind: ActionKind = 'custom', schemaFactory?: TSchemaFactory) {
    super(id, kind, 'bulk', schemaFactory)
  }

  static override make<
    TRecord extends object = RegisteredPanelRecord,
    TData extends object = object,
    TResult = void,
    TActor extends object = object,
    TTenant = unknown,
    TServices = object,
  >(name: string): BulkAction<TRecord, TData, TResult, TActor, TTenant, TServices> {
    return new BulkAction(name)
  }
}

export class ActionGroup<TAction extends ActionContract = ActionContract> {
  readonly actions: readonly TAction[]
  #badge: string | null = null
  #color: ActionColor | null = null
  #icon: string | null = null
  #label: string | null = null
  #tooltip: string | null = null

  protected constructor(actions: readonly TAction[]) {
    this.actions = Object.freeze([...actions])
  }

  static make<const TActions extends readonly ActionContract[]>(actions: TActions): ActionGroup<TActions[number]> {
    return new ActionGroup(actions)
  }

  badge(value: string | null): this {
    this.#badge = value
    return this
  }

  color(value: ActionColor | null): this {
    this.#color = value
    return this
  }

  icon(value: string | null): this {
    this.#icon = value
    return this
  }

  label(value: string | null): this {
    this.#label = value
    return this
  }

  tooltip(value: string | null): this {
    this.#tooltip = value
    return this
  }

  manifest(scope: 'bulk' | 'header' | 'row'): JsonObject {
    return {
      actions: this.actions.map(action => action.manifest(scope)),
      badge: this.#badge,
      color: this.#color,
      icon: this.#icon,
      id: this.actions.map(action => action.id).join('.'),
      kind: 'action-group',
      label: this.#label,
      scope,
      tooltip: this.#tooltip,
    }
  }
}

export class BulkActionGroup<TAction extends ActionContract = ActionContract> extends ActionGroup<TAction> {
  static override make<const TActions extends readonly ActionContract[]>(actions: TActions): BulkActionGroup<TActions[number]> {
    return new BulkActionGroup(actions)
  }
}

function makeBuiltIn<TRecord extends object>(id: string, kind: ActionKind, mount: ActionMount): Action<TRecord> {
  return applyBuiltInPresentation(new Action<TRecord>(id, kind, mount), id)
}

function makeBuiltInBulk<TRecord extends object>(id: string, kind: ActionKind): BulkAction<TRecord> {
  return applyBuiltInPresentation(new BulkAction<TRecord>(id, kind), id)
}

interface BuiltInActionPresenter {
  color(value: ActionColor | null): unknown
  icon(value: string | null): unknown
  requiresConfirmation(value: boolean | string): unknown
}

function applyBuiltInPresentation<TAction extends BuiltInActionPresenter>(action: TAction, name: string): TAction {
  const presentation = builtInActionPresentation(name)
  if (!presentation) return action
  action.color(presentation.color)
  action.icon(presentation.icon)
  if (presentation.confirmation) action.requiresConfirmation(presentation.confirmation)
  return action
}

export const CreateAction = Object.freeze({ make: <TRecord extends object = RegisteredPanelRecord>(): Action<TRecord> => makeBuiltIn('create', 'create', 'page') })
export const EditAction = Object.freeze({ make: <TRecord extends object = RegisteredPanelRecord>(): Action<TRecord> => makeBuiltIn('edit', 'edit', 'record') })
export const ViewAction = Object.freeze({ make: <TRecord extends object = RegisteredPanelRecord>(): Action<TRecord> => makeBuiltIn('view', 'view', 'record') })
export const DeleteAction = Object.freeze({ make: <TRecord extends object = RegisteredPanelRecord>(): Action<TRecord> => makeBuiltIn<TRecord>('delete', 'delete', 'record') })
export const DeleteBulkAction = Object.freeze({ make: <TRecord extends object = RegisteredPanelRecord>(): BulkAction<TRecord> => makeBuiltInBulk<TRecord>('delete', 'delete') })
export const AssociateAction = Object.freeze({ make: <TRecord extends object = RegisteredPanelRecord>(): Action<TRecord> => makeBuiltIn<TRecord>('associate', 'associate', 'page') })
export const AttachAction = Object.freeze({ make: <TRecord extends object = RegisteredPanelRecord>(): Action<TRecord> => makeBuiltIn<TRecord>('attach', 'attach', 'page') })
export const DetachAction = Object.freeze({ make: <TRecord extends object = RegisteredPanelRecord>(): Action<TRecord> => makeBuiltIn<TRecord>('detach', 'detach', 'record') })
export const DetachBulkAction = Object.freeze({ make: <TRecord extends object = RegisteredPanelRecord>(): BulkAction<TRecord> => makeBuiltInBulk<TRecord>('detach', 'detach') })
export const DissociateAction = Object.freeze({ make: <TRecord extends object = RegisteredPanelRecord>(): Action<TRecord> => makeBuiltIn<TRecord>('dissociate', 'dissociate', 'record') })
export const DissociateBulkAction = Object.freeze({ make: <TRecord extends object = RegisteredPanelRecord>(): BulkAction<TRecord> => makeBuiltInBulk<TRecord>('dissociate', 'dissociate') })
export const EditPivotAction = Object.freeze({ make: <TRecord extends object = RegisteredPanelRecord>(): Action<TRecord> => makeBuiltIn<TRecord>('edit-pivot', 'editPivot', 'record') })
export const ReplicateAction = Object.freeze({ make: <TRecord extends object = RegisteredPanelRecord>(): Action<TRecord> => makeBuiltIn('replicate', 'replicate', 'record') })
export const ForceDeleteAction = Object.freeze({ make: <TRecord extends object = RegisteredPanelRecord>(): Action<TRecord> => makeBuiltIn<TRecord>('force-delete', 'force-delete', 'record') })
export const ForceDeleteBulkAction = Object.freeze({ make: <TRecord extends object = RegisteredPanelRecord>(): BulkAction<TRecord> => makeBuiltInBulk<TRecord>('force-delete', 'force-delete') })
export const RestoreAction = Object.freeze({ make: <TRecord extends object = RegisteredPanelRecord>(): Action<TRecord> => makeBuiltIn('restore', 'restore', 'record') })
export const RestoreBulkAction = Object.freeze({ make: <TRecord extends object = RegisteredPanelRecord>(): BulkAction<TRecord> => makeBuiltInBulk('restore', 'restore') })
export const ImportAction = Object.freeze({ make: <TRecord extends object = RegisteredPanelRecord>(): Action<TRecord> => makeBuiltIn('import', 'custom', 'page') })
export const ExportAction = Object.freeze({ make: <TRecord extends object = RegisteredPanelRecord>(): Action<TRecord> => makeBuiltIn('export', 'custom', 'page') })

export interface ActionFactory<
  TRecord extends object,
  TData extends object = object,
  TActor extends object = object,
  TTenant = unknown,
  TServices = object,
  TSchemaFactory = undefined,
> {
  readonly Action: { make<TResult = void>(name: string): Action<TRecord, TData, TResult, TActor, TTenant, TServices, TSchemaFactory> }
  readonly ActionGroup: { make<const TActions extends readonly ActionContract<TRecord>[]>(actions: TActions): ActionGroup<TActions[number]> }
  readonly AssociateAction: { make(): Action<TRecord, TData, void, TActor, TTenant, TServices, TSchemaFactory> }
  readonly AttachAction: { make(): Action<TRecord, TData, void, TActor, TTenant, TServices, TSchemaFactory> }
  readonly BulkAction: { make<TResult = void>(name: string): BulkAction<TRecord, TData, TResult, TActor, TTenant, TServices, TSchemaFactory> }
  readonly BulkActionGroup: { make<const TActions extends readonly ActionContract<TRecord>[]>(actions: TActions): BulkActionGroup<TActions[number]> }
  readonly CreateAction: { make(): Action<TRecord, TData, void, TActor, TTenant, TServices, TSchemaFactory> }
  readonly DeleteAction: { make(): Action<TRecord, TData, void, TActor, TTenant, TServices, TSchemaFactory> }
  readonly DeleteBulkAction: { make(): BulkAction<TRecord, TData, void, TActor, TTenant, TServices, TSchemaFactory> }
  readonly DetachAction: { make(): Action<TRecord, TData, void, TActor, TTenant, TServices, TSchemaFactory> }
  readonly DetachBulkAction: { make(): BulkAction<TRecord, TData, void, TActor, TTenant, TServices, TSchemaFactory> }
  readonly DissociateAction: { make(): Action<TRecord, TData, void, TActor, TTenant, TServices, TSchemaFactory> }
  readonly DissociateBulkAction: { make(): BulkAction<TRecord, TData, void, TActor, TTenant, TServices, TSchemaFactory> }
  readonly EditAction: { make(): Action<TRecord, TData, void, TActor, TTenant, TServices, TSchemaFactory> }
  readonly EditPivotAction: { make(): Action<TRecord, TData, void, TActor, TTenant, TServices, TSchemaFactory> }
  readonly ExportAction: { make(): Action<TRecord, TData, void, TActor, TTenant, TServices, TSchemaFactory> }
  readonly ForceDeleteAction: { make(): Action<TRecord, TData, void, TActor, TTenant, TServices, TSchemaFactory> }
  readonly ForceDeleteBulkAction: { make(): BulkAction<TRecord, TData, void, TActor, TTenant, TServices, TSchemaFactory> }
  readonly ImportAction: { make(): Action<TRecord, TData, void, TActor, TTenant, TServices, TSchemaFactory> }
  readonly ReplicateAction: { make(): Action<TRecord, TData, void, TActor, TTenant, TServices, TSchemaFactory> }
  readonly RestoreAction: { make(): Action<TRecord, TData, void, TActor, TTenant, TServices, TSchemaFactory> }
  readonly RestoreBulkAction: { make(): BulkAction<TRecord, TData, void, TActor, TTenant, TServices, TSchemaFactory> }
  readonly ViewAction: { make(): Action<TRecord, TData, void, TActor, TTenant, TServices, TSchemaFactory> }
}

export function createActionFactory<
  TRecord extends object,
  TData extends object = object,
  TActor extends object = object,
  TTenant = unknown,
  TServices = object,
  TSchemaFactory = undefined,
>(schemaFactory?: TSchemaFactory): ActionFactory<TRecord, TData, TActor, TTenant, TServices, TSchemaFactory> {
  const action = (id: string, kind: ActionKind, mount: ActionMount): Action<TRecord, TData, void, TActor, TTenant, TServices, TSchemaFactory> => applyBuiltInPresentation(new Action(id, kind, mount, schemaFactory), id)
  const bulkAction = (id: string, kind: ActionKind): BulkAction<TRecord, TData, void, TActor, TTenant, TServices, TSchemaFactory> => applyBuiltInPresentation(new BulkAction(id, kind, schemaFactory), id)
  return Object.freeze({
    Action: Object.freeze({ make: <TResult = void>(name: string) => new Action<TRecord, TData, TResult, TActor, TTenant, TServices, TSchemaFactory>(name, 'custom', 'record', schemaFactory) }),
    ActionGroup: Object.freeze({ make: <const TActions extends readonly ActionContract<TRecord>[]>(actions: TActions) => ActionGroup.make(actions) }),
    AssociateAction: Object.freeze({ make: () => action('associate', 'associate', 'page') }),
    AttachAction: Object.freeze({ make: () => action('attach', 'attach', 'page') }),
    BulkAction: Object.freeze({ make: <TResult = void>(name: string) => new BulkAction<TRecord, TData, TResult, TActor, TTenant, TServices, TSchemaFactory>(name, 'custom', schemaFactory) }),
    BulkActionGroup: Object.freeze({ make: <const TActions extends readonly ActionContract<TRecord>[]>(actions: TActions) => BulkActionGroup.make(actions) }),
    CreateAction: Object.freeze({ make: () => action('create', 'create', 'page') }),
    DeleteAction: Object.freeze({ make: () => action('delete', 'delete', 'record') }),
    DeleteBulkAction: Object.freeze({ make: () => bulkAction('delete', 'delete') }),
    DetachAction: Object.freeze({ make: () => action('detach', 'detach', 'record') }),
    DetachBulkAction: Object.freeze({ make: () => bulkAction('detach', 'detach') }),
    DissociateAction: Object.freeze({ make: () => action('dissociate', 'dissociate', 'record') }),
    DissociateBulkAction: Object.freeze({ make: () => bulkAction('dissociate', 'dissociate') }),
    EditAction: Object.freeze({ make: () => action('edit', 'edit', 'record') }),
    EditPivotAction: Object.freeze({ make: () => action('edit-pivot', 'editPivot', 'record') }),
    ExportAction: Object.freeze({ make: () => action('export', 'custom', 'page') }),
    ForceDeleteAction: Object.freeze({ make: () => action('force-delete', 'force-delete', 'record') }),
    ForceDeleteBulkAction: Object.freeze({ make: () => bulkAction('force-delete', 'force-delete') }),
    ImportAction: Object.freeze({ make: () => action('import', 'custom', 'page') }),
    ReplicateAction: Object.freeze({ make: () => action('replicate', 'replicate', 'record') }),
    RestoreAction: Object.freeze({ make: () => action('restore', 'restore', 'record') }),
    RestoreBulkAction: Object.freeze({ make: () => bulkAction('restore', 'restore') }),
    ViewAction: Object.freeze({ make: () => action('view', 'view', 'record') }),
  })
}
