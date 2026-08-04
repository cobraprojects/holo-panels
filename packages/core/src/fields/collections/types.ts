import type { FormSchema, InferFormData, StandardSchemaV1Issue } from '@holo-js/forms'
import type { JsonObject, JsonValue } from '../../protocol/json'

export interface KeyValueEntry {
  readonly key: string
  readonly value: string
}

export type RichTextNodeType =
  | 'blockquote'
  | 'bullet-list'
  | 'code-block'
  | 'doc'
  | 'hard-break'
  | 'heading'
  | 'list-item'
  | 'ordered-list'
  | 'paragraph'
  | 'text'

export type RichTextMarkType = 'bold' | 'code' | 'italic' | 'link' | 'strike' | 'underline'

export interface RichTextMark extends JsonObject {
  attrs: JsonObject
  type: RichTextMarkType
}

export interface RichTextNode extends JsonObject {
  attrs: JsonObject
  content: RichTextNode[]
  marks: RichTextMark[]
  text: string | null
  type: RichTextNodeType
}

export interface RichTextDocument extends RichTextNode {
  type: 'doc'
}

export interface RichTextSanitizer {
  sanitize(document: RichTextDocument): RichTextDocument
}

export interface BuilderBlockDefinition<TSchema extends FormSchema = FormSchema> {
  readonly icon?: string
  readonly label: string
  readonly schema: TSchema
  readonly type: string
}

export type BuilderBlockMap = Readonly<Record<string, BuilderBlockDefinition>>

export type BuilderBlockValue<TBlocks extends BuilderBlockMap> = {
  [TType in keyof TBlocks & string]: {
    readonly data: InferFormData<TBlocks[TType]['schema']>
    readonly type: TType
  }
}[keyof TBlocks & string]

export interface BuilderBlockValidationIssue {
  readonly blockIndex: number
  readonly blockType: string
  readonly issues: readonly StandardSchemaV1Issue[]
}

export interface CollectionFieldProperties extends JsonObject {
  editorAdapter: string | null
  maximumItems: number | null
  minimumItems: number
}

export type CollectionValue = readonly JsonValue[]
