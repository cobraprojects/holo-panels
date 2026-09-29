import type { InferValidationSchemaData, ValidationSchema } from '@holo-js/validation'
import type { JsonObject } from '../../protocol/json'
import type { ExtensionTypeId } from '../../plugins/type-id'
import {
  FormSchemaBinding,
  type FormFieldPath,
  type FormFieldPathFor,
  type FormFieldValue,
} from '../base'
import {
  CheckboxFieldBuilder,
  ColorFieldBuilder,
  DateFieldBuilder,
  HiddenFieldBuilder,
  RadioFieldBuilder,
  SliderFieldBuilder,
  SlugFieldBuilder,
  TextareaFieldBuilder,
  TextFieldBuilder,
  ToggleFieldBuilder,
} from './fields'
import { customField, type CustomFieldBuilder, type CustomFieldDefinition } from '../custom'

export class BasicFieldFactory<TSchema extends ValidationSchema> {
  readonly #binding: FormSchemaBinding<TSchema>

  constructor(schema: TSchema) {
    this.#binding = new FormSchemaBinding(schema)
  }

  text<TPath extends FormFieldPathFor<InferValidationSchemaData<TSchema>, string | number>>(path: TPath): TextFieldBuilder<InferValidationSchemaData<TSchema>, TPath> {
    return new TextFieldBuilder(this.#binding.bind(path))
  }

  textarea<TPath extends FormFieldPathFor<InferValidationSchemaData<TSchema>, string>>(path: TPath): TextareaFieldBuilder<InferValidationSchemaData<TSchema>, TPath> {
    return new TextareaFieldBuilder(this.#binding.bind(path))
  }

  checkbox<TPath extends FormFieldPathFor<InferValidationSchemaData<TSchema>, boolean>>(path: TPath): CheckboxFieldBuilder<InferValidationSchemaData<TSchema>, TPath> {
    return new CheckboxFieldBuilder(this.#binding.bind(path))
  }

  toggle<TPath extends FormFieldPathFor<InferValidationSchemaData<TSchema>, boolean>>(path: TPath): ToggleFieldBuilder<InferValidationSchemaData<TSchema>, TPath> {
    return new ToggleFieldBuilder(this.#binding.bind(path))
  }

  radio<TPath extends FormFieldPathFor<InferValidationSchemaData<TSchema>, boolean | number | string>>(path: TPath): RadioFieldBuilder<InferValidationSchemaData<TSchema>, TPath> {
    return new RadioFieldBuilder(this.#binding.bind(path))
  }

  date<TPath extends FormFieldPathFor<InferValidationSchemaData<TSchema>, Date>>(path: TPath): DateFieldBuilder<InferValidationSchemaData<TSchema>, TPath> {
    return new DateFieldBuilder(this.#binding.bind(path), 'date')
  }

  time<TPath extends FormFieldPathFor<InferValidationSchemaData<TSchema>, Date>>(path: TPath): DateFieldBuilder<InferValidationSchemaData<TSchema>, TPath> {
    return new DateFieldBuilder(this.#binding.bind(path), 'time')
  }

  dateTime<TPath extends FormFieldPathFor<InferValidationSchemaData<TSchema>, Date>>(path: TPath): DateFieldBuilder<InferValidationSchemaData<TSchema>, TPath> {
    return new DateFieldBuilder(this.#binding.bind(path), 'date-time')
  }

  hidden<TPath extends FormFieldPath<InferValidationSchemaData<TSchema>>>(path: TPath): HiddenFieldBuilder<InferValidationSchemaData<TSchema>, TPath, FormFieldValue<InferValidationSchemaData<TSchema>, TPath>> {
    return new HiddenFieldBuilder(this.#binding.bind(path))
  }

  slider<TPath extends FormFieldPathFor<InferValidationSchemaData<TSchema>, number>>(path: TPath): SliderFieldBuilder<InferValidationSchemaData<TSchema>, TPath> {
    return new SliderFieldBuilder(this.#binding.bind(path))
  }

  color<TPath extends FormFieldPathFor<InferValidationSchemaData<TSchema>, string>>(path: TPath): ColorFieldBuilder<InferValidationSchemaData<TSchema>, TPath> {
    return new ColorFieldBuilder(this.#binding.bind(path))
  }

  slug<TPath extends FormFieldPathFor<InferValidationSchemaData<TSchema>, string>>(path: TPath): SlugFieldBuilder<InferValidationSchemaData<TSchema>, TPath> {
    return new SlugFieldBuilder(this.#binding.bind(path))
  }

  custom<
    TPath extends FormFieldPath<InferValidationSchemaData<TSchema>>,
    TValue,
    TType extends ExtensionTypeId<'field'>,
    TProperties extends JsonObject,
    TContext,
  >(
    path: TPath,
    typeId: TType,
    definition: CustomFieldDefinition<TValue, TProperties, TContext>,
  ): CustomFieldBuilder<InferValidationSchemaData<TSchema>, TPath, TValue, TType, TProperties> {
    return customField(this.#binding.bind(path), typeId, definition)
  }
}

export function fields<TSchema extends ValidationSchema>(schema: TSchema): BasicFieldFactory<TSchema> {
  return new BasicFieldFactory(schema)
}
