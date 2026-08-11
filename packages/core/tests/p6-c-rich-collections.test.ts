import { field, schema, type InferFormData } from '@holo-js/forms'
import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import {
  collectionFields,
  deserializeRichText,
  serializeMarkdown,
  serializeRichText,
  structuralRichTextSanitizer,
  validateBuilderBlocks,
  type BuilderBlockValue,
  type RichTextDocument,
} from '../src/fields/collections'

const contentSchema = schema({
  tags: field.array(field.string()),
  metadata: field.array({ key: field.string(), value: field.string() }),
  source: field.string(),
  markdown: field.string(),
  rich: field.string(),
  sections: field.array({ heading: field.string(), body: field.string() }),
  blocks: field.array({ type: field.string(), data: { heading: field.string().optional(), body: field.string().optional() } }),
})

const heroSchema = schema({ heading: field.string().required(), body: field.string().optional() })
const quoteSchema = schema({ body: field.string().required() })
const blockDefinitions = {
  hero: { icon: 'sparkles', label: 'Hero', schema: heroSchema, type: 'hero' },
  quote: { label: 'Quote', schema: quoteSchema, type: 'quote' },
} as const

type ContentValues = InferFormData<typeof contentSchema>
type ContentBlock = BuilderBlockValue<typeof blockDefinitions>

function documentWithText(text: string): RichTextDocument {
  return {
    attrs: {},
    content: [{
      attrs: {},
      content: [],
      marks: [{ attrs: {}, type: 'bold' }],
      text,
      type: 'text',
    }],
    marks: [],
    text: null,
    type: 'doc',
  }
}

describe('P6-C rich and collection field definitions', () => {
  it('preserves inferred collection values and common fluent methods', () => {
    const fields = collectionFields(contentSchema)
    const tags = fields.tags('tags').minimumItems(1).maximumItems(10).separator(';').allowDuplicates(false).label('Tags')
    const keyValue = fields.keyValue('metadata').uniqueKeys().compile()
    const repeater = fields.repeater('sections').minimumItems(1).maximumItems(8).collapsible().cloneable().reorderable().compile()

    expectTypeOf(tags.compile().defaultValue).toEqualTypeOf<ContentValues['tags'] | undefined>()
    expectTypeOf(repeater.defaultValue).toEqualTypeOf<ContentValues['sections'] | undefined>()
    expect(tags.compile().properties).toEqual({
      allowDuplicates: false,
      maximumItems: 10,
      minimumItems: 1,
      separator: ';',
    })
    expect(keyValue.properties).toEqual({ maximumItems: null, minimumItems: 0, uniqueKeys: true })
    expect(repeater.properties).toEqual({
      collapsible: true,
      cloneable: true,
      fields: [
        { label: 'Heading', path: 'heading', properties: {}, required: false, type: 'text' },
        { label: 'Body', path: 'body', properties: {}, required: false, type: 'text' },
      ],
      maximumItems: 8,
      minimumItems: 1,
      reorderable: true,
    })
  })

  it('compiles code, Markdown, rich editor, and typed builder contracts', () => {
    const fields = collectionFields(contentSchema)
    const code = fields.code('source').language('typescript').lineNumbers().editorAdapter('monaco').compile()
    const markdown = fields.markdown('markdown').preview().editorAdapter('milkdown').compile()
    const rich = fields.richEditor('rich').sanitizer('structural').editorAdapter('tiptap').compile()
    const builder = fields.builder('blocks', blockDefinitions).minimumItems(1).maximumItems(20).compile()

    expect(code.properties).toEqual({ editorAdapter: 'monaco', language: 'typescript', lineNumbers: true })
    expect(markdown.properties).toEqual({ editorAdapter: 'milkdown', preview: true, rawHtml: false })
    expect(rich.properties).toEqual({
      editorAdapter: 'tiptap',
      format: 'structured-json',
      sanitizer: 'structural',
      unsafeRawHtml: false,
    })
    expect(builder.properties.blocks).toEqual([
      {
        fields: [
          { label: 'Heading', path: 'heading', properties: {}, required: true, type: 'text' },
          { label: 'Body', path: 'body', properties: {}, required: false, type: 'text' },
        ],
        icon: 'sparkles',
        label: 'Hero',
        type: 'hero',
      },
      {
        fields: [{ label: 'Body', path: 'body', properties: {}, required: true, type: 'text' }],
        icon: null,
        label: 'Quote',
        type: 'quote',
      },
    ])
    expect(() => fields.richEditor('rich').compile()).toThrow(/explicit sanitizer boundary/)
    expect(() => fields.tags('tags').minimumItems(5).maximumItems(2).compile()).toThrow(/cannot exceed/)
  })
})

describe('P6-C block validation', () => {
  it('validates each block against its own Holo schema with nested paths', async () => {
    const valid: ContentBlock[] = [
      { type: 'hero', data: { heading: 'Launch', body: undefined } },
      { type: 'quote', data: { body: 'Ship it' } },
    ]
    const invalid: ContentBlock[] = [
      { type: 'hero', data: { heading: '', body: undefined } },
      { type: 'quote', data: { body: '' } },
    ]

    await expect(validateBuilderBlocks(valid, blockDefinitions)).resolves.toEqual([])
    const issues = await validateBuilderBlocks(invalid, blockDefinitions)
    expect(issues).toHaveLength(2)
    expect(issues[0]?.issues[0]?.path).toEqual([{ key: 0 }, { key: 'data' }, { key: 'heading' }])
    expect(issues[1]?.issues[0]?.path).toEqual([{ key: 1 }, { key: 'data' }, { key: 'body' }])
    await expect(validateBuilderBlocks([{ type: 'script', data: { body: '<script>' } }], blockDefinitions))
      .resolves.toEqual([expect.objectContaining({ blockIndex: 0, blockType: 'script' })])
  })
})

describe('P6-C rich content security', () => {
  it('normalizes Markdown while escaping every raw HTML boundary', () => {
    expect(serializeMarkdown('# Safe\r\n<script>alert(1)</script>'))
      .toBe('# Safe\n&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('requires and invokes an explicit sanitizer for rich serialization', () => {
    const sanitizer = { sanitize: vi.fn(structuralRichTextSanitizer.sanitize) }
    const serialized = serializeRichText(documentWithText('<img src=x onerror=alert(1)>'), sanitizer)
    const hydrated = deserializeRichText(serialized, structuralRichTextSanitizer)

    expect(sanitizer.sanitize).toHaveBeenCalledOnce()
    expect(hydrated.content[0]?.text).toBe('<img src=x onerror=alert(1)>')
    expect(JSON.parse(serialized)).toEqual(hydrated)
  })

  it('rejects raw HTML nodes, unsafe links, and unrecognized document structures', () => {
    const htmlNode = JSON.stringify({ attrs: {}, content: [], marks: [], text: null, type: 'html' })
    const unsafeLink = JSON.stringify({
      attrs: {},
      content: [{
        attrs: {},
        content: [],
        marks: [{ attrs: { href: 'javascript:alert(1)' }, type: 'link' }],
        text: 'click',
        type: 'text',
      }],
      marks: [],
      text: null,
      type: 'doc',
    })

    expect(() => deserializeRichText(htmlNode, structuralRichTextSanitizer)).toThrow(/document object/)
    expect(() => deserializeRichText(unsafeLink, structuralRichTextSanitizer)).toThrow()
    expect(() => deserializeRichText('[]', structuralRichTextSanitizer)).toThrow(/document object/)
  })

  it('does not expose schemas, validation callbacks, or sanitizer functions in field properties', () => {
    const serialized = JSON.stringify(collectionFields(contentSchema).builder('blocks', blockDefinitions).compile().properties)
    expect(serialized).not.toContain('~standard')
    expect(serialized).not.toContain('validate')
    expect(serialized).not.toContain('function')
  })
})
