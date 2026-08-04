import {
  exampleCategories,
  exampleComments,
  exampleMedia,
  examplePosts,
  examplePostTags,
  exampleTags,
  exampleTenants,
  recordsForTenant,
} from './fixtures/example-domain'

export interface BlogQuery {
  readonly category?: string | null
  readonly tag?: string | null
  readonly tenant?: string | null
}

function resolveTenant(routeKey: string | null | undefined) {
  return exampleTenants.find(tenant => tenant.routeKey === routeKey) ?? exampleTenants[0]
}

function safeMedia(mediaId: string | null, tenantId: string) {
  if (!mediaId) return null
  const media = exampleMedia.find(item => item.id === mediaId && item.tenantId === tenantId)
  if (!media) return null
  return { alt: media.alt, private: media.disk === 'private', url: null }
}

function publicPost(post: typeof examplePosts[number]) {
  const category = exampleCategories.find(item => item.id === post.categoryId && item.tenantId === post.tenantId)
  const tagIds = new Set(examplePostTags.filter(item => item.postId === post.id && item.tenantId === post.tenantId).map(item => item.tagId))
  const tags = exampleTags.filter(tag => tag.tenantId === post.tenantId && tagIds.has(tag.id)).map(tag => ({ name: tag.name, slug: tag.slug }))
  return {
    body: post.body,
    category: category ? { name: category.name, slug: category.slug } : null,
    excerpt: post.excerpt,
    media: safeMedia(post.featuredMediaId, post.tenantId),
    slug: post.slug,
    tags,
    title: post.title,
  }
}

export function getBlogIndex(query: BlogQuery = {}) {
  const tenant = resolveTenant(query.tenant)
  const posts = recordsForTenant(examplePosts, tenant.id)
    .filter(post => post.status === 'published')
    .filter(post => !query.category || exampleCategories.some(category => category.id === post.categoryId && category.tenantId === tenant.id && category.slug === query.category))
    .filter(post => !query.tag || examplePostTags.some(postTag => postTag.postId === post.id && postTag.tenantId === tenant.id && exampleTags.some(tag => tag.id === postTag.tagId && tag.slug === query.tag)))
    .map(publicPost)
  return {
    activeFilters: { category: query.category ?? null, tag: query.tag ?? null },
    categories: recordsForTenant(exampleCategories, tenant.id).map(category => ({ name: category.name, slug: category.slug })),
    posts,
    tags: recordsForTenant(exampleTags, tenant.id).map(tag => ({ name: tag.name, slug: tag.slug })),
    tenant: { name: tenant.name, routeKey: tenant.routeKey },
    tenants: exampleTenants.map(item => ({ name: item.name, routeKey: item.routeKey })),
  }
}

export function getBlogPost(slug: string, query: BlogQuery = {}) {
  const tenant = resolveTenant(query.tenant)
  const post = examplePosts.find(item => item.tenantId === tenant.id && item.slug === slug && item.status === 'published')
  if (!post) return null
  return {
    comments: exampleComments
      .filter(comment => comment.tenantId === tenant.id && comment.postId === post.id && comment.status === 'approved')
      .map(comment => ({ authorName: comment.authorName, body: comment.body, id: comment.id })),
    post: publicPost(post),
    tenant: { name: tenant.name, routeKey: tenant.routeKey },
  }
}
