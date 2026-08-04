import { error } from '@sveltejs/kit'
import { getBlogPost } from '../../../../server/blog'
import type { PageServerLoad } from './$types'

export const load = (({ params, url }) => {
  const result = getBlogPost(params.slug, { tenant: url.searchParams.get('tenant') })
  if (!result) error(404, 'Published post not found')
  return result
}) satisfies PageServerLoad
