import { isFormSchema, type FieldDefinition, type FormSchema, type InferFormData } from '@holo-js/forms'
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

export class FormSchemaBinding<TSchema extends FormSchema> {
  readonly schema: TSchema

  constructor(schema: TSchema) {
    if (!isFormSchema(schema)) {
      throw new Error('Fields must bind to a Holo form schema')
    }
    this.schema = schema
  }

  bind<TPath extends FormFieldPath<InferFormData<TSchema>>>(
    path: TPath,
  ): BoundFormField<InferFormData<TSchema>, TPath> {
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

export function bindFormSchema<TSchema extends FormSchema>(schema: TSchema): FormSchemaBinding<TSchema> {
  return new FormSchemaBinding(schema)
}
