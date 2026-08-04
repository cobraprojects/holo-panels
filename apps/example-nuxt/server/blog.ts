import { exampleDomainRecords, exampleTenants } from './admin/domain/fixtures'

export interface ExampleBlogQuery {
  readonly category?: string | null
  readonly tag?: string | null
  readonly tenant?: string | null
}

const resolveTenant = (routeKey: string | null | undefined) => (
  exampleTenants.find(tenant => tenant.key === routeKey) ?? exampleTenants[0]
)

const publicPost = (post: typeof exampleDomainRecords.posts[number]) => {
  const category = exampleDomainRecords.categories.find(candidate => (
    candidate.id === post.categoryId && candidate.tenantId === post.tenantId
  ))
  const tagIds = new Set(exampleDomainRecords.postTags
    .filter(relation => relation.postId === post.id && relation.tenantId === post.tenantId)
    .map(relation => relation.tagId))
  const tags = exampleDomainRecords.tags
    .filter(tag => tag.tenantId === post.tenantId && tagIds.has(tag.id))
    .map(tag => ({ name: tag.name, slug: tag.slug }))
  const media = post.featuredMediaId
    ? exampleDomainRecords.media.find(candidate => candidate.id === post.featuredMediaId && candidate.tenantId === post.tenantId)
    : null

  return {
    body: post.body,
    category: category ? { name: category.name, slug: category.slug } : null,
    excerpt: post.excerpt,
    media: media ? { alt: media.alt, private: media.disk === 'private' } : null,
    slug: post.slug,
    tags,
    title: post.title,
  }
}

export const getExampleBlogIndex = (query: ExampleBlogQuery = {}) => {
  const tenant = resolveTenant(query.tenant)
  if (!tenant) throw new Error('The example tenant inventory is empty')
  const posts = exampleDomainRecords.posts
    .filter(post => post.tenantId === tenant.id && post.status === 'published')
    .filter(post => !query.category || exampleDomainRecords.categories.some(category => (
      category.id === post.categoryId && category.tenantId === tenant.id && category.slug === query.category
    )))
    .filter(post => !query.tag || exampleDomainRecords.postTags.some(relation => (
      relation.postId === post.id
      && relation.tenantId === tenant.id
      && exampleDomainRecords.tags.some(tag => tag.id === relation.tagId && tag.tenantId === tenant.id && tag.slug === query.tag)
    )))
    .map(publicPost)

  return {
    activeFilters: { category: query.category ?? null, tag: query.tag ?? null },
    categories: exampleDomainRecords.categories.filter(category => category.tenantId === tenant.id).map(category => ({ name: category.name, slug: category.slug })),
    posts,
    tags: exampleDomainRecords.tags.filter(tag => tag.tenantId === tenant.id).map(tag => ({ name: tag.name, slug: tag.slug })),
    tenant: { name: tenant.name, routeKey: tenant.key },
    tenants: exampleTenants.map(candidate => ({ name: candidate.name, routeKey: candidate.key })),
  }
}

export const getExampleBlogPost = (slug: string, query: ExampleBlogQuery = {}) => {
  const tenant = resolveTenant(query.tenant)
  if (!tenant) return null
  const post = exampleDomainRecords.posts.find(candidate => (
    candidate.tenantId === tenant.id && candidate.slug === slug && candidate.status === 'published'
  ))
  if (!post) return null
  return {
    comments: exampleDomainRecords.comments
      .filter(comment => comment.tenantId === tenant.id && comment.postId === post.id && comment.status === 'approved')
      .map(comment => ({ authorName: comment.authorName, body: comment.body, id: comment.id })),
    post: publicPost(post),
    tenant: { name: tenant.name, routeKey: tenant.key },
  }
}
