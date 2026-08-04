import type { FormSchema, InferFormData } from '@holo-js/forms'
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

export class BasicFieldFactory<TSchema extends FormSchema> {
  readonly #binding: FormSchemaBinding<TSchema>

  constructor(schema: TSchema) {
    this.#binding = new FormSchemaBinding(schema)
  }

  text<TPath extends FormFieldPathFor<InferFormData<TSchema>, string | number>>(path: TPath): TextFieldBuilder<InferFormData<TSchema>, TPath> {
    return new TextFieldBuilder(this.#binding.bind(path))
  }

  textarea<TPath extends FormFieldPathFor<InferFormData<TSchema>, string>>(path: TPath): TextareaFieldBuilder<InferFormData<TSchema>, TPath> {
    return new TextareaFieldBuilder(this.#binding.bind(path))
  }

  checkbox<TPath extends FormFieldPathFor<InferFormData<TSchema>, boolean>>(path: TPath): CheckboxFieldBuilder<InferFormData<TSchema>, TPath> {
    return new CheckboxFieldBuilder(this.#binding.bind(path))
  }

  toggle<TPath extends FormFieldPathFor<InferFormData<TSchema>, boolean>>(path: TPath): ToggleFieldBuilder<InferFormData<TSchema>, TPath> {
    return new ToggleFieldBuilder(this.#binding.bind(path))
  }

  radio<TPath extends FormFieldPathFor<InferFormData<TSchema>, boolean | number | string>>(path: TPath): RadioFieldBuilder<InferFormData<TSchema>, TPath> {
    return new RadioFieldBuilder(this.#binding.bind(path))
  }

  date<TPath extends FormFieldPathFor<InferFormData<TSchema>, Date>>(path: TPath): DateFieldBuilder<InferFormData<TSchema>, TPath> {
    return new DateFieldBuilder(this.#binding.bind(path), 'date')
  }

  time<TPath extends FormFieldPathFor<InferFormData<TSchema>, Date>>(path: TPath): DateFieldBuilder<InferFormData<TSchema>, TPath> {
    return new DateFieldBuilder(this.#binding.bind(path), 'time')
  }

  dateTime<TPath extends FormFieldPathFor<InferFormData<TSchema>, Date>>(path: TPath): DateFieldBuilder<InferFormData<TSchema>, TPath> {
    return new DateFieldBuilder(this.#binding.bind(path), 'date-time')
  }

  hidden<TPath extends FormFieldPath<InferFormData<TSchema>>>(path: TPath): HiddenFieldBuilder<InferFormData<TSchema>, TPath, FormFieldValue<InferFormData<TSchema>, TPath>> {
    return new HiddenFieldBuilder(this.#binding.bind(path))
  }

  slider<TPath extends FormFieldPathFor<InferFormData<TSchema>, number>>(path: TPath): SliderFieldBuilder<InferFormData<TSchema>, TPath> {
    return new SliderFieldBuilder(this.#binding.bind(path))
  }

  color<TPath extends FormFieldPathFor<InferFormData<TSchema>, string>>(path: TPath): ColorFieldBuilder<InferFormData<TSchema>, TPath> {
    return new ColorFieldBuilder(this.#binding.bind(path))
  }

  slug<TPath extends FormFieldPathFor<InferFormData<TSchema>, string>>(path: TPath): SlugFieldBuilder<InferFormData<TSchema>, TPath> {
    return new SlugFieldBuilder(this.#binding.bind(path))
  }

  custom<
    TPath extends FormFieldPath<InferFormData<TSchema>>,
    TValue,
    TType extends ExtensionTypeId<'field'>,
    TProperties extends JsonObject,
    TContext,
  >(
    path: TPath,
    typeId: TType,
    definition: CustomFieldDefinition<TValue, TProperties, TContext>,
  ): CustomFieldBuilder<InferFormData<TSchema>, TPath, TValue, TType, TProperties> {
    return customField(this.#binding.bind(path), typeId, definition)
  }
}

export function fields<TSchema extends FormSchema>(schema: TSchema): BasicFieldFactory<TSchema> {
  return new BasicFieldFactory(schema)
}
