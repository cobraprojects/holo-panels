import type { FieldDefinition, FormSchema, InferFormData, WebFileLike } from '@holo-js/forms'
import type { JsonObject } from '../../protocol/json'
import { toJsonValue } from '../../protocol/serialization'
import {
  FieldBuilder,
  FormSchemaBinding,
  type BoundFormField,
  type FormFieldPath,
  type FormFieldPathFor,
  type FormFieldValue,
} from '../base'
import type { UploadPolicy } from './contracts'
import { defineUploadPolicy } from './policy'

function isFileDefinition(definition: FieldDefinition): boolean {
  if (definition.kind === 'file') return true
  if (definition.kind !== 'array' || !definition.item || !('kind' in definition.item)) return false
  return definition.item.kind === 'file'
}

export class UploadFieldBuilder<
  TValues,
  TPath extends FormFieldPath<TValues>,
  TRecord = unknown,
> extends FieldBuilder<TValues, TPath, FormFieldValue<TValues, TPath>, 'panels:field:upload', TRecord> {
  readonly policy: UploadPolicy

  constructor(binding: BoundFormField<TValues, TPath>, policy: UploadPolicy) {
    super('panels:field:upload', binding)
    this.policy = defineUploadPolicy(policy)
  }

  protected assertSchemaKind(definition: FieldDefinition): void {
    if (!isFileDefinition(definition)) throw new Error('Upload fields require a Holo file field or array of file fields')
  }

  protected override fieldProperties(): JsonObject {
    return { uploadPolicy: toJsonValue(this.policy) }
  }
}

type UploadFieldValue = WebFileLike | readonly WebFileLike[]

export class UploadFieldFactory<TSchema extends FormSchema> {
  readonly #binding: FormSchemaBinding<TSchema>

  constructor(schema: TSchema) {
    this.#binding = new FormSchemaBinding(schema)
  }

  file<TPath extends FormFieldPathFor<InferFormData<TSchema>, UploadFieldValue>>(
    path: TPath,
    policy: UploadPolicy,
  ): UploadFieldBuilder<InferFormData<TSchema>, TPath> {
    return new UploadFieldBuilder(this.#binding.bind(path), policy)
  }
}

export function uploadFields<TSchema extends FormSchema>(schema: TSchema): UploadFieldFactory<TSchema> {
  return new UploadFieldFactory(schema)
}
