import { type InferValidationSchemaData, isValidationSchema, type FieldDefinition, type ValidationSchema } from '@holo-js/validation'
import type { BoundFormField, FormFieldPath } from './types'

interface SchemaFieldNode {
  readonly kind: 'field'
  readonly definition: FieldDefinition
}

interface SchemaBranch {
  readonly [key: string]: SchemaFieldNode | SchemaBranch
}

function isSchemaFieldNode(value: SchemaFieldNode | SchemaBranch | undefined): value is SchemaFieldNode {
  return value?.kind === 'field' && 'definition' in value
}

export class FormSchemaBinding<TSchema extends ValidationSchema> {
  readonly schema: TSchema

  constructor(schema: TSchema) {
    if (!isValidationSchema(schema)) {
      throw new Error('Fields must bind to a Holo form schema')
    }
    this.schema = schema
  }

  bind<TPath extends FormFieldPath<InferValidationSchemaData<TSchema>>>(
    path: TPath,
  ): BoundFormField<InferValidationSchemaData<TSchema>, TPath> {
    const segments = path.split('.')
    let current: SchemaFieldNode | SchemaBranch | undefined = this.schema.fields as SchemaBranch
    for (const segment of segments) {
      if (/^[0-9]+$/.test(segment)) {
        throw new Error(`Array item paths require a concrete nested Holo schema: ${path}`)
      }
      if (!current || isSchemaFieldNode(current)) {
        throw new Error(`Holo form schema path does not resolve to a field: ${path}`)
      }
      current = current[segment]
    }
    if (!isSchemaFieldNode(current)) {
      throw new Error(`Holo form schema path does not resolve to a field: ${path}`)
    }
    return Object.freeze({ path, schema: current.definition })
  }
}

export function bindFormSchema<TSchema extends ValidationSchema>(schema: TSchema): FormSchemaBinding<TSchema> {
  return new FormSchemaBinding(schema)
}
