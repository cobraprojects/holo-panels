const fixtureTimestamp = '2026-07-28T00:00:00.000Z'

export const exampleTenants = Object.freeze([
  Object.freeze({ id: 'tenant-acme', key: 'acme', name: 'Acme' }),
  Object.freeze({ id: 'tenant-globex', key: 'globex', name: 'Globex' }),
])

export const exampleActors = Object.freeze([
  Object.freeze({ email: 'super@example.test', id: 'user-super-admin', role: 'super-admin', tenantId: 'tenant-acme', tenantIds: ['tenant-acme', 'tenant-globex'] }),
  Object.freeze({ email: 'admin@acme.example.test', id: 'user-acme-admin', role: 'tenant-admin', tenantId: 'tenant-acme', tenantIds: ['tenant-acme'] }),
  Object.freeze({ email: 'editor@acme.example.test', id: 'user-acme-editor', role: 'editor', tenantId: 'tenant-acme', tenantIds: ['tenant-acme'] }),
  Object.freeze({ email: 'editor@globex.example.test', id: 'user-globex-editor', role: 'editor', tenantId: 'tenant-globex', tenantIds: ['tenant-globex'] }),
  Object.freeze({ email: 'denied@example.test', id: 'user-denied', role: 'denied', tenantId: null, tenantIds: [] }),
])

const users = exampleActors.map(actor => Object.freeze({
  created_at: fixtureTimestamp,
  email: actor.email,
  id: actor.id,
  name: actor.id === 'user-denied' ? 'Denied User' : actor.id.split('-').slice(1).map(part => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`).join(' '),
  updated_at: fixtureTimestamp,
}))

const categories = Object.freeze([
  Object.freeze({ created_at: fixtureTimestamp, id: 'category-acme-guides', name: 'Guides', slug: 'guides', tenantId: 'tenant-acme', updated_at: fixtureTimestamp }),
  Object.freeze({ created_at: fixtureTimestamp, id: 'category-acme-news', name: 'News', slug: 'news', tenantId: 'tenant-acme', updated_at: fixtureTimestamp }),
  Object.freeze({ created_at: fixtureTimestamp, id: 'category-globex-guides', name: 'Guides', slug: 'guides', tenantId: 'tenant-globex', updated_at: fixtureTimestamp }),
  Object.freeze({ created_at: fixtureTimestamp, id: 'category-globex-news', name: 'News', slug: 'news', tenantId: 'tenant-globex', updated_at: fixtureTimestamp }),
])

const tags = Object.freeze([
  Object.freeze({ created_at: fixtureTimestamp, id: 'tag-acme-holo', name: 'Holo', slug: 'holo', tenantId: 'tenant-acme', updated_at: fixtureTimestamp }),
  Object.freeze({ created_at: fixtureTimestamp, id: 'tag-acme-typescript', name: 'TypeScript', slug: 'typescript', tenantId: 'tenant-acme', updated_at: fixtureTimestamp }),
  Object.freeze({ created_at: fixtureTimestamp, id: 'tag-acme-tutorial', name: 'Tutorial', slug: 'tutorial', tenantId: 'tenant-acme', updated_at: fixtureTimestamp }),
  Object.freeze({ created_at: fixtureTimestamp, id: 'tag-globex-holo', name: 'Holo', slug: 'holo', tenantId: 'tenant-globex', updated_at: fixtureTimestamp }),
  Object.freeze({ created_at: fixtureTimestamp, id: 'tag-globex-typescript', name: 'TypeScript', slug: 'typescript', tenantId: 'tenant-globex', updated_at: fixtureTimestamp }),
  Object.freeze({ created_at: fixtureTimestamp, id: 'tag-globex-tutorial', name: 'Tutorial', slug: 'tutorial', tenantId: 'tenant-globex', updated_at: fixtureTimestamp }),
])

const media = Object.freeze([
  Object.freeze({ alt: 'Layered translucent panels', created_at: fixtureTimestamp, disk: 'private', id: 'media-acme-cover', mime: 'image/svg+xml', path: 'tenant-acme/posts/panels-cover.svg', size: 318, tenantId: 'tenant-acme', updated_at: fixtureTimestamp }),
  Object.freeze({ alt: 'Globex geometric cover', created_at: fixtureTimestamp, disk: 'private', id: 'media-globex-cover', mime: 'image/svg+xml', path: 'tenant-globex/posts/platform-cover.svg', size: 304, tenantId: 'tenant-globex', updated_at: fixtureTimestamp }),
])

const posts = Object.freeze([
  Object.freeze({ authorId: 'user-acme-editor', body: 'Build administrative applications with typed resources and framework-native rendering.', category: 'Guides', categoryId: 'category-acme-guides', city: 'Cairo', created_at: fixtureTimestamp, excerpt: 'A practical introduction to Holo Panels.', featuredMediaId: 'media-acme-cover', id: 'post-acme-panels', slug: 'building-with-holo-panels', status: 'published', tenantId: 'tenant-acme', title: 'Building with Holo Panels', updated_at: fixtureTimestamp }),
  Object.freeze({ authorId: 'user-acme-editor', body: 'A stable release is ready for Acme readers.', category: 'News', categoryId: 'category-acme-news', city: 'Cairo', created_at: fixtureTimestamp, excerpt: 'Acme release news.', featuredMediaId: null, id: 'post-acme-release', slug: 'acme-release', status: 'published', tenantId: 'tenant-acme', title: 'Acme release', updated_at: fixtureTimestamp }),
  Object.freeze({ authorId: 'user-acme-editor', body: 'This draft must never appear on the public blog.', category: 'News', categoryId: 'category-acme-news', city: 'Cairo', created_at: fixtureTimestamp, excerpt: 'An unpublished Acme draft.', featuredMediaId: null, id: 'post-acme-draft', slug: 'acme-draft', status: 'draft', tenantId: 'tenant-acme', title: 'Acme draft', updated_at: fixtureTimestamp }),
  Object.freeze({ authorId: 'user-globex-editor', body: 'Globex uses an isolated panel and content catalog.', category: 'Guides', categoryId: 'category-globex-guides', city: 'London', created_at: fixtureTimestamp, excerpt: 'A Globex platform guide.', featuredMediaId: 'media-globex-cover', id: 'post-globex-platform', slug: 'globex-platform', status: 'published', tenantId: 'tenant-globex', title: 'Globex platform', updated_at: fixtureTimestamp }),
  Object.freeze({ authorId: 'user-globex-editor', body: 'Globex roadmap details remain within Globex.', category: 'News', categoryId: 'category-globex-news', city: 'London', created_at: fixtureTimestamp, excerpt: 'Globex roadmap news.', featuredMediaId: null, id: 'post-globex-roadmap', slug: 'globex-roadmap', status: 'published', tenantId: 'tenant-globex', title: 'Globex roadmap', updated_at: fixtureTimestamp }),
  Object.freeze({ authorId: 'user-globex-editor', body: 'This Globex draft is private.', category: 'News', categoryId: 'category-globex-news', city: 'London', created_at: fixtureTimestamp, excerpt: 'An unpublished Globex draft.', featuredMediaId: null, id: 'post-globex-draft', slug: 'globex-draft', status: 'draft', tenantId: 'tenant-globex', title: 'Globex draft', updated_at: fixtureTimestamp }),
])

const comments = Object.freeze([
  Object.freeze({ authorName: 'Ada', body: 'The resource boundaries are clear.', created_at: fixtureTimestamp, id: 'comment-acme-approved', postId: 'post-acme-panels', status: 'approved', tenantId: 'tenant-acme', updated_at: fixtureTimestamp }),
  Object.freeze({ authorName: 'Grace', body: 'Awaiting Acme moderation.', created_at: fixtureTimestamp, id: 'comment-acme-pending', postId: 'post-acme-panels', status: 'pending', tenantId: 'tenant-acme', updated_at: fixtureTimestamp }),
  Object.freeze({ authorName: 'Linus', body: 'Globex approved comment.', created_at: fixtureTimestamp, id: 'comment-globex-approved', postId: 'post-globex-platform', status: 'approved', tenantId: 'tenant-globex', updated_at: fixtureTimestamp }),
  Object.freeze({ authorName: 'Margaret', body: 'Awaiting Globex moderation.', created_at: fixtureTimestamp, id: 'comment-globex-pending', postId: 'post-globex-platform', status: 'pending', tenantId: 'tenant-globex', updated_at: fixtureTimestamp }),
])

const memberships = Object.freeze([
  Object.freeze({ created_at: fixtureTimestamp, id: 'membership-super-acme', roleKey: 'super-admin', tenantId: 'tenant-acme', updated_at: fixtureTimestamp, userId: 'user-super-admin' }),
  Object.freeze({ created_at: fixtureTimestamp, id: 'membership-super-globex', roleKey: 'super-admin', tenantId: 'tenant-globex', updated_at: fixtureTimestamp, userId: 'user-super-admin' }),
  Object.freeze({ created_at: fixtureTimestamp, id: 'membership-acme-admin', roleKey: 'tenant-admin', tenantId: 'tenant-acme', updated_at: fixtureTimestamp, userId: 'user-acme-admin' }),
  Object.freeze({ created_at: fixtureTimestamp, id: 'membership-acme-editor', roleKey: 'editor', tenantId: 'tenant-acme', updated_at: fixtureTimestamp, userId: 'user-acme-editor' }),
  Object.freeze({ created_at: fixtureTimestamp, id: 'membership-globex-editor', roleKey: 'editor', tenantId: 'tenant-globex', updated_at: fixtureTimestamp, userId: 'user-globex-editor' }),
])

const postTags = Object.freeze([
  Object.freeze({ created_at: fixtureTimestamp, id: 'post-tag-post-acme-panels-tag-acme-holo', position: 1, postId: 'post-acme-panels', tagId: 'tag-acme-holo', tenantId: 'tenant-acme', updated_at: fixtureTimestamp }),
  Object.freeze({ created_at: fixtureTimestamp, id: 'post-tag-post-acme-panels-tag-acme-typescript', position: 2, postId: 'post-acme-panels', tagId: 'tag-acme-typescript', tenantId: 'tenant-acme', updated_at: fixtureTimestamp }),
  Object.freeze({ created_at: fixtureTimestamp, id: 'post-tag-post-acme-release-tag-acme-holo', position: 1, postId: 'post-acme-release', tagId: 'tag-acme-holo', tenantId: 'tenant-acme', updated_at: fixtureTimestamp }),
  Object.freeze({ created_at: fixtureTimestamp, id: 'post-tag-post-acme-draft-tag-acme-tutorial', position: 1, postId: 'post-acme-draft', tagId: 'tag-acme-tutorial', tenantId: 'tenant-acme', updated_at: fixtureTimestamp }),
  Object.freeze({ created_at: fixtureTimestamp, id: 'post-tag-post-globex-platform-tag-globex-holo', position: 1, postId: 'post-globex-platform', tagId: 'tag-globex-holo', tenantId: 'tenant-globex', updated_at: fixtureTimestamp }),
  Object.freeze({ created_at: fixtureTimestamp, id: 'post-tag-post-globex-platform-tag-globex-typescript', position: 2, postId: 'post-globex-platform', tagId: 'tag-globex-typescript', tenantId: 'tenant-globex', updated_at: fixtureTimestamp }),
  Object.freeze({ created_at: fixtureTimestamp, id: 'post-tag-post-globex-roadmap-tag-globex-tutorial', position: 1, postId: 'post-globex-roadmap', tagId: 'tag-globex-tutorial', tenantId: 'tenant-globex', updated_at: fixtureTimestamp }),
  Object.freeze({ created_at: fixtureTimestamp, id: 'post-tag-post-globex-draft-tag-globex-holo', position: 1, postId: 'post-globex-draft', tagId: 'tag-globex-holo', tenantId: 'tenant-globex', updated_at: fixtureTimestamp }),
])

export const exampleDomainRecords = Object.freeze({
  categories,
  comments,
  media,
  memberships,
  postTags,
  posts,
  tags,
  users: Object.freeze(users),
})
