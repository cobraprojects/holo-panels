import type { RelationDefinition } from '@holo-js/db'
import type { RelationOperation } from './contracts'

const operationMap = Object.freeze({
  belongsTo: ['select', 'associate', 'dissociate', 'create'] as const,
  belongsToMany: ['list', 'attach', 'detach', 'create', 'edit', 'editPivot'] as const,
  hasMany: ['list', 'view', 'create', 'edit', 'associate', 'dissociate', 'delete'] as const,
  hasManyThrough: ['list', 'view'] as const,
  hasOne: ['view', 'create', 'edit', 'delete'] as const,
  hasOneOfMany: ['view'] as const,
  hasOneThrough: ['view'] as const,
  morphMany: ['list', 'view', 'create', 'edit', 'associate', 'dissociate', 'delete'] as const,
  morphOne: ['view', 'create', 'edit', 'delete'] as const,
  morphOneOfMany: ['view'] as const,
  morphTo: ['select', 'associate', 'dissociate', 'create'] as const,
  morphToMany: ['list', 'attach', 'detach', 'create', 'edit', 'editPivot'] as const,
  morphedByMany: ['list', 'attach', 'detach', 'create', 'edit', 'editPivot'] as const,
} satisfies Readonly<Record<RelationDefinition['kind'], readonly RelationOperation[]>>)

export function allowedRelationOperations(relation: RelationDefinition): readonly RelationOperation[] {
  return operationMap[relation.kind]
}

export function relationSupportsOperation(
  relation: RelationDefinition,
  operation: RelationOperation,
): boolean {
  return allowedRelationOperations(relation).includes(operation)
}
