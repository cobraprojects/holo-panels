import type { StandardSchemaV1Issue } from '@holo-js/forms'
import type { BuilderBlockMap, BuilderBlockValidationIssue } from './types'

export interface SubmittedBuilderBlock {
  readonly data: unknown
  readonly type: string
}

function prefixIssues(index: number, issues: readonly StandardSchemaV1Issue[]): readonly StandardSchemaV1Issue[] {
  return issues.map(issue => ({
    ...issue,
    path: [{ key: index }, { key: 'data' }, ...(issue.path ?? [])],
  }))
}

export async function validateBuilderBlocks<TBlocks extends BuilderBlockMap>(
  blocks: readonly SubmittedBuilderBlock[],
  definitions: TBlocks,
): Promise<readonly BuilderBlockValidationIssue[]> {
  const issues: BuilderBlockValidationIssue[] = []
  for (const [blockIndex, block] of blocks.entries()) {
    const definition = definitions[block.type]
    if (!definition) {
      issues.push({
        blockIndex,
        blockType: block.type,
        issues: [{ message: `Unsupported builder block type: ${block.type}`, path: [{ key: blockIndex }, { key: 'type' }] }],
      })
      continue
    }
    const result = await definition.schema['~standard'].validate(block.data)
    if (result.issues) {
      issues.push({ blockIndex, blockType: block.type, issues: prefixIssues(blockIndex, result.issues) })
    }
  }
  return Object.freeze(issues)
}
