import type { RelationDefinition } from '@holo-js/db'
import type { OptionValue } from '../fields/options'
import type { OptionalRuntimeTypeValue, RecordTypeSource, RecordTypeValue, RuntimeTypeSource, RuntimeTypeValue } from '../inference/type-source'
import { allowedRelationOperations } from './metadata'
import type { ResourceCompositionTypes } from '../resources/contracts'
import type {
  RelationManagerAuthorization,
  RelationManagerContext,
  RelationManagerDefinition,
  RelationManagerTransaction,
  RelationOperation,
  RelationPersistence,
  RelationPresentation,
  RelationValidation,
} from './contracts'

const identifierPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/iu

function assertIdentifier(value: string, label: string): void {
  if (!identifierPattern.test(value)) throw new Error(`[Holo Panels] Invalid relation manager ${label} "${value}".`)
}

export interface RelationManagerBuilderOptions<
  TOwner,
  TRelated,
  TQuery,
  TInput extends Readonly<Record<string, unknown>>,
  TPivot extends Readonly<Record<string, unknown>>,
  TValue extends OptionValue,
  TActor extends object,
  TTenant,
> {
  readonly relationName: string
  readonly relation: RelationDefinition
  readonly persistence: RelationPersistence<TOwner, TRelated, TQuery, TInput, TPivot, TValue, TActor, TTenant>
  readonly authorization: RelationManagerAuthorization<TOwner, TRelated, TActor, TTenant>
  readonly transaction: RelationManagerTransaction
}

export class RelationManagerBuilder<
  TOwner,
  TRelated,
  TQuery,
  TInput extends Readonly<Record<string, unknown>>,
  TPivot extends Readonly<Record<string, unknown>>,
  TValue extends OptionValue,
  TActor extends object,
  TTenant,
> {
  declare readonly resourceCompositionTypes: ResourceCompositionTypes<TOwner, TActor, TTenant>
  readonly #relationName: string
  readonly #relation: RelationDefinition
  readonly #persistence: RelationPersistence<TOwner, TRelated, TQuery, TInput, TPivot, TValue, TActor, TTenant>
  readonly #authorization: RelationManagerAuthorization<TOwner, TRelated, TActor, TTenant>
  readonly #transaction: RelationManagerTransaction
  #id: string
  #operations: readonly RelationOperation[]
  #presentation: RelationPresentation = 'inline'
  #group: string | null = null
  #badge: RelationManagerDefinition<TOwner, TRelated, TQuery, TInput, TPivot, TValue, TActor, TTenant>['badge'] = null
  #visible: RelationManagerDefinition<TOwner, TRelated, TQuery, TInput, TPivot, TValue, TActor, TTenant>['visible'] = () => true
  #inputValidation?: RelationValidation<TInput, RelationManagerContext<TOwner, TActor, TTenant>>
  #pivotValidation?: RelationValidation<TPivot, RelationManagerContext<TOwner, TActor, TTenant>>
  #writableInputFields: readonly Extract<keyof TInput, string>[] = []
  #writablePivotFields: readonly Extract<keyof TPivot, string>[] = []
  #compiled?: RelationManagerDefinition<TOwner, TRelated, TQuery, TInput, TPivot, TValue, TActor, TTenant>

  constructor(options: RelationManagerBuilderOptions<TOwner, TRelated, TQuery, TInput, TPivot, TValue, TActor, TTenant>) {
    assertIdentifier(options.relationName, 'relation name')
    this.#relationName = options.relationName
    this.#id = options.relationName
    this.#relation = options.relation
    this.#operations = allowedRelationOperations(options.relation)
    this.#persistence = options.persistence
    this.#authorization = options.authorization
    this.#transaction = options.transaction
  }

  id(id: string): this {
    this.assertMutable()
    assertIdentifier(id, 'ID')
    this.#id = id
    return this
  }

  operations(operations: readonly RelationOperation[]): this {
    this.assertMutable()
    const allowed = new Set(allowedRelationOperations(this.#relation))
    const unique = [...new Set(operations)]
    for (const operation of unique) {
      if (!allowed.has(operation)) {
        throw new Error(`[Holo Panels] Relation kind "${this.#relation.kind}" does not allow operation "${operation}".`)
      }
    }
    this.#operations = Object.freeze(unique)
    return this
  }
  presentation(presentation: RelationPresentation, group?: string): this {
    this.assertMutable()
    if (presentation === 'groupedTabs' && !group?.trim()) {
      throw new Error('[Holo Panels] Grouped relation tabs require a group label.')
    }
    this.#presentation = presentation
    this.#group = group?.trim() || null
    return this
  }

  visibleWhen(
    visible: (context: RelationManagerContext<TOwner, TActor, TTenant>) => boolean | Promise<boolean>,
  ): this {
    this.assertMutable()
    this.#visible = visible
    return this
  }

  badge(
    badge: (context: RelationManagerContext<TOwner, TActor, TTenant>) => string | number | Promise<string | number>,
  ): this {
    this.assertMutable()
    this.#badge = badge
    return this
  }

  fields<TField extends Extract<keyof TInput, string>>(
    fields: readonly TField[],
    validation?: RelationValidation<TInput, RelationManagerContext<TOwner, TActor, TTenant>>,
  ): this {
    this.assertMutable()
    this.#writableInputFields = Object.freeze([...new Set(fields)])
    this.#inputValidation = validation
    return this
  }

  pivotFields<TField extends Extract<keyof TPivot, string>>(
    fields: readonly TField[],
    validation?: RelationValidation<TPivot, RelationManagerContext<TOwner, TActor, TTenant>>,
  ): this {
    this.assertMutable()
    this.#writablePivotFields = Object.freeze([...new Set(fields)])
    this.#pivotValidation = validation
    return this
  }

  compile(): RelationManagerDefinition<TOwner, TRelated, TQuery, TInput, TPivot, TValue, TActor, TTenant> {
    if (this.#compiled) return this.#compiled
    this.assertPersistenceOperation('associate', this.#persistence.associate)
    this.assertPersistenceOperation('attach', this.#persistence.attach)
    this.assertPersistenceOperation('detach', this.#persistence.detach)
    this.assertPersistenceOperation('dissociate', this.#persistence.dissociate)
    this.assertPersistenceOperation('editPivot', this.#persistence.updatePivot)
    this.#compiled = Object.freeze({
      id: this.#id,
      relationName: this.#relationName,
      relation: this.#relation,
      operations: Object.freeze([...this.#operations]),
      presentation: this.#presentation,
      group: this.#group,
      badge: this.#badge,
      visible: this.#visible,
      persistence: this.#persistence,
      authorization: this.#authorization,
      transaction: this.#transaction,
      ...(this.#inputValidation ? { inputValidation: this.#inputValidation } : {}),
      ...(this.#pivotValidation ? { pivotValidation: this.#pivotValidation } : {}),
      writableInputFields: this.#writableInputFields,
      writablePivotFields: this.#writablePivotFields,
    })
    return this.#compiled
  }

  private assertMutable(): void {
    if (this.#compiled) throw new Error('[Holo Panels] A compiled relation manager cannot be modified.')
  }

  private assertPersistenceOperation(operation: RelationOperation, implementation: ((...parameters: never[]) => unknown) | undefined): void {
    if (this.#operations.includes(operation) && !implementation) {
      throw new Error(`[Holo Panels] Relation operation "${operation}" requires a persistence implementation.`)
    }
  }
}

export function relationManagersFor<
  TOwnerSource extends RecordTypeSource,
  TRelatedSource extends RecordTypeSource,
  TQuerySource extends RuntimeTypeSource,
  TInputSource extends RecordTypeSource,
  TPivotSource extends RecordTypeSource,
  TValueSource extends NumberConstructor | StringConstructor,
  TActorSource extends { readonly prototype: object },
  TTenantSource extends RuntimeTypeSource | undefined = undefined,
>(_sources: {
  readonly actor: TActorSource
  readonly input: TInputSource
  readonly owner: TOwnerSource
  readonly pivot: TPivotSource
  readonly query: TQuerySource
  readonly related: TRelatedSource
  readonly tenant?: TTenantSource
  readonly value: TValueSource
}): {
  define(options: RelationManagerBuilderOptions<
    RecordTypeValue<TOwnerSource>,
    RecordTypeValue<TRelatedSource>,
    RuntimeTypeValue<TQuerySource>,
    RecordTypeValue<TInputSource> & Readonly<Record<string, unknown>>,
    RecordTypeValue<TPivotSource> & Readonly<Record<string, unknown>>,
    Extract<RuntimeTypeValue<TValueSource>, OptionValue>,
    Extract<RuntimeTypeValue<TActorSource>, object>,
    OptionalRuntimeTypeValue<TTenantSource>
  >): RelationManagerBuilder<
    RecordTypeValue<TOwnerSource>,
    RecordTypeValue<TRelatedSource>,
    RuntimeTypeValue<TQuerySource>,
    RecordTypeValue<TInputSource> & Readonly<Record<string, unknown>>,
    RecordTypeValue<TPivotSource> & Readonly<Record<string, unknown>>,
    Extract<RuntimeTypeValue<TValueSource>, OptionValue>,
    Extract<RuntimeTypeValue<TActorSource>, object>,
    OptionalRuntimeTypeValue<TTenantSource>
  >
} {
  return Object.freeze({
    define: options => new RelationManagerBuilder(options),
  })
}
