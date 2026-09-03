import { field, schema, type InferFormData } from '@holo-js/forms'
import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  bindFormSchema,
  dehydrateFieldValue,
  deriveFieldClientHints,
  fields,
  hydrateFieldValue,
  resolveFieldDefault,
  resolveFieldPresentationState,
  TextFieldBuilder,
  validateFormFields,
  type FormFieldPath,
  type FormFieldValue,
} from '../src/fields'

const postSchema = schema({
  title: field.string().required().min(3).max(120),
  email: field.string().required().email(),
  age: field.number().optional(),
  published: field.boolean().default(false),
  publishedAt: field.date().optional(),
  color: field.string().optional(),
  profile: {
    biography: field.string().optional(),
  },
})

type PostValues = InferFormData<typeof postSchema>

function postContext<TPath extends FormFieldPath<PostValues>>(
  path: TPath,
  values: PostValues,
): {
  readonly operation: 'edit'
  readonly path: TPath
  readonly value: FormFieldValue<PostValues, TPath>
  readonly values: Readonly<PostValues>
  get<TDependencyPath extends FormFieldPath<PostValues>>(
    dependencyPath: TDependencyPath,
  ): FormFieldValue<PostValues, TDependencyPath>
} {
  return {
    operation: 'edit',
    path,
    value: path.split('.').reduce<unknown>((current, segment) => (
      typeof current === 'object' && current !== null
        ? Reflect.get(current, segment)
        : undefined
    ), values) as FormFieldValue<PostValues, TPath>,
    values,
    get: dependencyPath => dependencyPath.split('.').reduce<unknown>((current, segment) => (
      typeof current === 'object' && current !== null
        ? Reflect.get(current, segment)
        : undefined
    ), values) as FormFieldValue<PostValues, typeof dependencyPath>,
  }
}

describe('P6-A common field contracts', () => {
  it('localizes built-in Holo validation without changing valid field values', async () => {
    const definitions = [
      { path: 'title', type: 'text', required: true },
      { path: 'email', type: 'text', properties: { inputMode: 'email' } },
      { path: 'age', type: 'number', properties: { minimum: 18 } },
    ]
    expect(await validateFormFields(definitions, { title: '', email: 'invalid', age: 12 }, 'ar')).toEqual({
      title: ['هذا الحقل مطلوب.'],
      email: ['أدخل عنوان بريد إلكتروني صحيحًا.'],
      age: ['يجب ألا تقل القيمة عن 18.'],
    })
    expect(await validateFormFields(definitions, { title: 'عنوان', email: 'author@example.test', age: 21 }, 'ar')).toEqual({})
  })

  it('preserves concrete nested form paths and values', () => {
    expectTypeOf<FormFieldPath<PostValues>>().toEqualTypeOf<
      'age' | 'color' | 'email' | 'profile.biography' | 'published' | 'publishedAt' | 'title'
    >()
    expectTypeOf<FormFieldValue<PostValues, 'profile.biography'>>().toEqualTypeOf<string | undefined>()
    expectTypeOf(fields(postSchema).text('title').compile().defaultValue).toEqualTypeOf<string | undefined>()
    expectTypeOf(fields(postSchema).checkbox('published').compile().defaultValue).toEqualTypeOf<boolean | undefined>()
    expectTypeOf(fields(postSchema).date('publishedAt').compile().defaultValue).toEqualTypeOf<Date | undefined>()
  })

  it('binds only to public Holo form schemas and concrete fields', () => {
    const binding = bindFormSchema(postSchema)

    expect(binding.bind('profile.biography').schema.kind).toBe('string')
    expect(() => binding.bind('profile' as never)).toThrow('does not resolve to a field')
    expect(() => bindFormSchema({ kind: 'schema' } as never)).toThrow('Holo form schema')
  })

  it('derives convenience hints from Holo rules without changing validation', async () => {
    const title = bindFormSchema(postSchema).bind('title')
    const hints = deriveFieldClientHints(title.schema)

    expect(hints).toEqual({
      kind: 'string',
      required: true,
      nullable: false,
      minimum: 3,
      maximum: 120,
    })
    expect(postSchema.fields.title.definition.rules.map(rule => rule.name)).toEqual(['required', 'min', 'max'])
    const definitions = [fields(postSchema).text('title').compile(), fields(postSchema).text('email').compile()]
    expect(await validateFormFields(definitions, { title: 'x', email: 'x' })).toMatchObject({ title: expect.any(Array), email: expect.any(Array) })
    expect(await validateFormFields(definitions, { title: 'Launch', email: 'team@example.com' })).toEqual({})
    expect(await validateFormFields([
      { path: 'metadata', type: 'key-value', clientHints: { kind: 'array', required: false, nullable: false, minimum: 2 } },
      { path: 'body', type: 'rich-editor', clientHints: { kind: 'string', required: false, nullable: false, minimum: 20 } },
    ], { metadata: 'not-a-list', body: 'x' })).toMatchObject({ metadata: expect.any(Array), body: expect.any(Array) })
  })

  it('resolves hydration, presentation, errors, and allowed dehydration', async () => {
    const values: PostValues = {
      title: '  Launch  ',
      email: 'team@example.com',
      age: 42,
      published: false,
      publishedAt: undefined,
      color: '#3455db',
      profile: { biography: 'Bio' },
    }
    const definition = fields(postSchema)
      .text('title')
      .label(context => `Title for ${context.get('email')}`)
      .helperText('Public title')
      .hint('Keep it concise')
      .placeholder('Release title')
      .visible(context => context.get('age') === 42)
      .disabled(context => context.get('published'))
      .readOnly(false)
      .dependsOn('email', 'age', 'published')
      .debounce(150)
      .columnSpan(2)
      .columnStart(1)
      .extraAttributes({ 'data-test': 'title' })
      .hydrate(context => context.value.trim())
      .dehydrate(context => context.value.trim())
      .compile()
    const context = postContext('title', values)

    await expect(hydrateFieldValue(definition, context)).resolves.toBe('Launch')
    await expect(dehydrateFieldValue(definition, context)).resolves.toBe('Launch')
    await expect(resolveFieldPresentationState(definition, context, ['Already used'])).resolves.toEqual(expect.objectContaining({
      value: 'Launch',
      errors: ['Already used'],
      visible: true,
      disabled: false,
      readOnly: false,
      required: true,
      label: 'Title for team@example.com',
      helperText: 'Public title',
      hint: 'Keep it concise',
      placeholder: 'Release title',
    }))
    expect(definition.dependencies).toEqual(['email', 'age', 'published'])
    expect(definition.layout).toEqual({ columnSpan: 2, columnStart: 1 })
    expect(definition.extraAttributes).toEqual({ 'data-test': 'title' })

    const disabledValues = { ...values, published: true }
    await expect(dehydrateFieldValue(definition, postContext('title', disabledValues))).resolves.toBeUndefined()
  })

  it('uses Holo defaults and never lets a client required hint weaken Holo requiredness', async () => {
    const published = fields(postSchema).checkbox('published').compile()
    const title = fields(postSchema).text('title').required(false).compile()
    const dynamicDefault = fields(postSchema).text('title').default(context => context.get('email')).compile()
    const values: PostValues = {
      title: 'Launch',
      email: 'team@example.com',
      age: undefined,
      published: false,
      publishedAt: undefined,
      color: undefined,
      profile: { biography: undefined },
    }

    expect(published.defaultValue).toBe(false)
    expect(title.required).toBe(true)
    await expect(resolveFieldDefault(dynamicDefault, postContext('title', values))).resolves.toBe('team@example.com')
    expect(() => fields(postSchema).text('title').debounce(-1)).toThrow('non-negative integer')
    expect(() => fields(postSchema).text('title').extraAttributes({ invalid: undefined })).toThrow('JSON-safe')
  })
})

describe('P6-A basic fields', () => {
  it('compiles concrete text and textarea capabilities', () => {
    const text = fields(postSchema)
      .text('email')
      .email()
      .prefix('@')
      .suffix('.com')
      .mask('email')
      .autocomplete('email')
      .minLength(3)
      .maxLength(120)
      .datalist(['team@example.com'])
      .compile()
    const textarea = fields(postSchema).textarea('profile.biography').rows(8).autosize().maxLength(2_000).compile()

    expect(text.properties).toEqual(expect.objectContaining({
      inputMode: 'email',
      prefix: '@',
      suffix: '.com',
      mask: 'email',
      autocomplete: 'email',
      minimumLength: 3,
      maximumLength: 120,
      datalist: ['team@example.com'],
    }))
    expect(textarea.properties).toEqual({ rows: 8, autosize: true, maximumLength: 2_000 })
  })

  it('compiles boolean, radio, date, hidden, slider, and color states', () => {
    const formFields = fields(postSchema)
    const checkbox = formFields.checkbox('published').onLabel('Published').offLabel('Draft').compile()
    const toggle = formFields.toggle('published').onLabel('On').offLabel('Off').compile()
    const radio = formFields.radio('published').options([
      { value: true, label: 'Yes' },
      { value: false, label: 'No' },
    ]).inline().compile()
    const date = formFields.dateTime('publishedAt').min('2026-01-01').max('2027-01-01').compile()
    const hidden = formFields.hidden('age').compile()
    const slider = formFields.slider('age').range(18, 100).step(2).compile()
    const color = formFields.color('color').format('rgb').alpha().compile()

    expect(checkbox.type).toBe('checkbox')
    expect(toggle.type).toBe('toggle')
    expect(radio.properties).toEqual({
      inline: true,
      options: [
        { value: true, label: 'Yes', disabled: false },
        { value: false, label: 'No', disabled: false },
      ],
    })
    expect(date.properties).toEqual({ mode: 'date-time', minimum: '2026-01-01', maximum: '2027-01-01' })
    expect(hidden.type).toBe('hidden')
    expect(slider.properties).toEqual({ minimum: 18, maximum: 100, step: 2 })
    expect(color.properties).toEqual({ format: 'rgb', alpha: true })
  })

  it('provides slug local transformation and server normalization hooks', async () => {
    const values: PostValues = {
      title: 'Crème Brûlée Launch',
      email: 'team@example.com',
      age: undefined,
      published: false,
      publishedAt: undefined,
      color: undefined,
      profile: { biography: undefined },
    }
    const slug = fields(postSchema)
      .slug('email')
      .from('title')
      .normalizeUsing(context => context.value.replace(/-+/g, '-'))

    expect(slug.transformLocal(values.title)).toBe('creme-brulee-launch')
    const definition = slug.compile()
    expect(definition.properties).toEqual(expect.objectContaining({
      specialization: 'slug',
      source: 'title',
      localTransform: 'registered',
      serverNormalized: true,
    }))
    expect(definition.dependencies).toEqual(['title'])
    await expect(dehydrateFieldValue(definition, postContext('email', { ...values, email: 'launch--day' }))).resolves.toBe('launch-day')
  })

  it('rejects invalid type-specific invariants at the definition boundary', () => {
    expect(() => fields(postSchema).text('email').minLength(10).maxLength(2).compile()).toThrow('cannot exceed')
    expect(() => fields(postSchema).slider('age').range(10, 5)).toThrow('ascending bounds')
    expect(() => fields(postSchema).radio('published').options([
      { value: true, label: 'Yes' },
      { value: true, label: 'Again' },
    ])).toThrow('Duplicate radio option')
    expect(() => new TextFieldBuilder(bindFormSchema(postSchema).bind('published')).compile()).toThrow('cannot bind')
  })
})
