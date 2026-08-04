import type { FieldDefinition } from '@holo-js/forms'
import type { JsonObject, JsonValue } from '../protocol/json'
import type { ExtensionTypeId } from '../plugins/type-id'
import { FieldBuilder } from './base/field-builder'
import type { BoundFormField, FormFieldPath } from './base/types'

export interface CustomFieldDefinition<
  TValue,
  TProperties extends JsonObject,
  TContext,
> {
  readonly codec: {
    decode(value: JsonValue): TValue
    encode(value: TValue): JsonValue
  }
  readonly properties: TProperties
  readonly resolveOptions?: (context: TContext) => JsonValue | Promise<JsonValue>
  readonly validate?: (value: TValue, context: TContext) => void | Promise<void>
}

export class CustomFieldBuilder<
  TValues,
  TPath extends FormFieldPath<TValues>,
  TValue,
  TType extends ExtensionTypeId<'field'>,
  TProperties extends JsonObject,
  TRecord = unknown,
> extends FieldBuilder<TValues, TPath, TValue, TType, TRecord> {
  #properties: TProperties

  constructor(
    binding: BoundFormField<TValues, TPath>,
    typeId: TType,
    properties: TProperties,
  ) {
    super(typeId, binding)
    this.#properties = properties
  }

  properties(value: TProperties): this {
    this.assertMutable()
    this.#properties = value
    return this
  }

  protected override fieldProperties(): TProperties {
    return this.#properties
  }

  protected override assertSchemaKind(_definition: FieldDefinition): void {}
}

export function customField<
  TValues,
  TPath extends FormFieldPath<TValues>,
  TValue,
  TType extends ExtensionTypeId<'field'>,
  TProperties extends JsonObject,
  TContext,
>(
  binding: BoundFormField<TValues, TPath>,
  typeId: TType,
  definition: CustomFieldDefinition<TValue, TProperties, TContext>,
): CustomFieldBuilder<TValues, TPath, TValue, TType, TProperties> {
  if (typeof definition.codec.decode !== 'function' || typeof definition.codec.encode !== 'function') {
    throw new TypeError('Custom fields require encode and decode codecs')
  }
  if (definition.resolveOptions !== undefined && typeof definition.resolveOptions !== 'function') {
    throw new TypeError('Custom field option resolvers must be functions')
  }
  if (definition.validate !== undefined && typeof definition.validate !== 'function') {
    throw new TypeError('Custom field validators must be functions')
  }
  return new CustomFieldBuilder(binding, typeId, definition.properties)
}
