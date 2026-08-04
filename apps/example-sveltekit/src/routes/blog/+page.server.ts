import { getBlogIndex } from '../../../server/blog'
import type { PageServerLoad } from './$types'

export const load = (({ url }) => getBlogIndex({
  category: url.searchParams.get('category'),
  tag: url.searchParams.get('tag'),
  tenant: url.searchParams.get('tenant'),
})) satisfies PageServerLoad
