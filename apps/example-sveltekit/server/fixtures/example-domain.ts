import type { ExampleAdminActor, ExampleRoleKey } from './access'

export const exampleTenants = Object.freeze([
  { id: 'tenant-acme', name: 'Acme', routeKey: 'acme' },
  { id: 'tenant-globex', name: 'Globex', routeKey: 'globex' },
])

export const exampleActors: Readonly<Record<string, ExampleAdminActor>> = Object.freeze({
  'user-super-admin': { id: 'user-super-admin', name: 'Super Admin', roleKey: 'super-admin', tenantId: 'tenant-acme', tenantIds: ['tenant-acme', 'tenant-globex'] },
  'user-acme-admin': { id: 'user-acme-admin', name: 'Acme Admin', roleKey: 'tenant-admin', tenantId: 'tenant-acme', tenantIds: ['tenant-acme'] },
  'user-acme-editor': { id: 'user-acme-editor', name: 'Acme Editor', roleKey: 'editor', tenantId: 'tenant-acme', tenantIds: ['tenant-acme'] },
  'user-globex-editor': { id: 'user-globex-editor', name: 'Globex Editor', roleKey: 'editor', tenantId: 'tenant-globex', tenantIds: ['tenant-globex'] },
  'user-denied': { id: 'user-denied', name: 'Denied User', roleKey: 'denied', tenantId: 'tenant-acme', tenantIds: [] },
})

const createdAt = '2026-07-28T08:00:00.000Z'
const updatedAt = '2026-07-28T08:00:00.000Z'

export const exampleUsers = Object.freeze([
  { createdAt, email: 'super@example.test', id: 'user-super-admin', name: 'Super Admin', updatedAt },
  { createdAt, email: 'admin@acme.example.test', id: 'user-acme-admin', name: 'Acme Admin', updatedAt },
  { createdAt, email: 'editor@acme.example.test', id: 'user-acme-editor', name: 'Acme Editor', updatedAt },
  { createdAt, email: 'editor@globex.example.test', id: 'user-globex-editor', name: 'Globex Editor', updatedAt },
  { createdAt, email: 'denied@example.test', id: 'user-denied', name: 'Denied User', updatedAt },
])

export const exampleMemberships = Object.freeze([
  { createdAt, id: 'membership-super-acme', roleKey: 'super-admin' satisfies ExampleRoleKey, tenantId: 'tenant-acme', updatedAt, userId: 'user-super-admin' },
  { createdAt, id: 'membership-super-globex', roleKey: 'super-admin' satisfies ExampleRoleKey, tenantId: 'tenant-globex', updatedAt, userId: 'user-super-admin' },
  { createdAt, id: 'membership-acme-admin', roleKey: 'tenant-admin' satisfies ExampleRoleKey, tenantId: 'tenant-acme', updatedAt, userId: 'user-acme-admin' },
  { createdAt, id: 'membership-acme-editor', roleKey: 'editor' satisfies ExampleRoleKey, tenantId: 'tenant-acme', updatedAt, userId: 'user-acme-editor' },
  { createdAt, id: 'membership-globex-editor', roleKey: 'editor' satisfies ExampleRoleKey, tenantId: 'tenant-globex', updatedAt, userId: 'user-globex-editor' },
])

export const exampleCategories = Object.freeze([
  { createdAt, id: 'category-acme-guides', name: 'Guides', slug: 'guides', tenantId: 'tenant-acme', updatedAt },
  { createdAt, id: 'category-acme-news', name: 'News', slug: 'news', tenantId: 'tenant-acme', updatedAt },
  { createdAt, id: 'category-globex-guides', name: 'Guides', slug: 'guides', tenantId: 'tenant-globex', updatedAt },
  { createdAt, id: 'category-globex-news', name: 'News', slug: 'news', tenantId: 'tenant-globex', updatedAt },
])

export const exampleTags = Object.freeze([
  { createdAt, id: 'tag-acme-holo', name: 'Holo', slug: 'holo', tenantId: 'tenant-acme', updatedAt },
  { createdAt, id: 'tag-acme-typescript', name: 'TypeScript', slug: 'typescript', tenantId: 'tenant-acme', updatedAt },
  { createdAt, id: 'tag-acme-tutorial', name: 'Tutorial', slug: 'tutorial', tenantId: 'tenant-acme', updatedAt },
  { createdAt, id: 'tag-globex-holo', name: 'Holo', slug: 'holo', tenantId: 'tenant-globex', updatedAt },
  { createdAt, id: 'tag-globex-typescript', name: 'TypeScript', slug: 'typescript', tenantId: 'tenant-globex', updatedAt },
  { createdAt, id: 'tag-globex-tutorial', name: 'Tutorial', slug: 'tutorial', tenantId: 'tenant-globex', updatedAt },
])

export const exampleMedia = Object.freeze([
  { alt: 'Layered translucent panels', createdAt, disk: 'private', id: 'media-acme-cover', mime: 'image/svg+xml', path: 'tenant-acme/posts/panels-cover.svg', size: 318, tenantId: 'tenant-acme', updatedAt },
  { alt: 'Globex geometric cover', createdAt, disk: 'private', id: 'media-globex-cover', mime: 'image/svg+xml', path: 'tenant-globex/posts/platform-cover.svg', size: 304, tenantId: 'tenant-globex', updatedAt },
])

export const examplePosts = Object.freeze([
  { authorId: 'user-acme-editor', body: 'Build administrative applications with typed resources and framework-native rendering.', category: 'Guides', categoryId: 'category-acme-guides', city: 'Cairo', createdAt, excerpt: 'A practical introduction to Holo Panels.', featuredMediaId: 'media-acme-cover', id: 'post-acme-panels', slug: 'building-with-holo-panels', status: 'published', tenantId: 'tenant-acme', title: 'Building with Holo Panels', updatedAt },
  { authorId: 'user-acme-editor', body: 'A stable release is ready for Acme readers.', category: 'News', categoryId: 'category-acme-news', city: 'Cairo', createdAt, excerpt: 'Acme release news.', featuredMediaId: null, id: 'post-acme-release', slug: 'acme-release', status: 'published', tenantId: 'tenant-acme', title: 'Acme release', updatedAt },
  { authorId: 'user-acme-editor', body: 'This draft must never appear on the public blog.', category: 'News', categoryId: 'category-acme-news', city: 'Cairo', createdAt, excerpt: 'An unpublished Acme draft.', featuredMediaId: null, id: 'post-acme-draft', slug: 'acme-draft', status: 'draft', tenantId: 'tenant-acme', title: 'Acme draft', updatedAt },
  { authorId: 'user-globex-editor', body: 'Globex uses an isolated panel and content catalog.', category: 'Guides', categoryId: 'category-globex-guides', city: 'London', createdAt, excerpt: 'A Globex platform guide.', featuredMediaId: 'media-globex-cover', id: 'post-globex-platform', slug: 'globex-platform', status: 'published', tenantId: 'tenant-globex', title: 'Globex platform', updatedAt },
  { authorId: 'user-globex-editor', body: 'Globex roadmap details remain within Globex.', category: 'News', categoryId: 'category-globex-news', city: 'London', createdAt, excerpt: 'Globex roadmap news.', featuredMediaId: null, id: 'post-globex-roadmap', slug: 'globex-roadmap', status: 'published', tenantId: 'tenant-globex', title: 'Globex roadmap', updatedAt },
  { authorId: 'user-globex-editor', body: 'This Globex draft is private.', category: 'News', categoryId: 'category-globex-news', city: 'London', createdAt, excerpt: 'An unpublished Globex draft.', featuredMediaId: null, id: 'post-globex-draft', slug: 'globex-draft', status: 'draft', tenantId: 'tenant-globex', title: 'Globex draft', updatedAt },
])

export const examplePostTags = Object.freeze([
  { createdAt, id: 'post-tag-post-acme-panels-tag-acme-holo', position: 1, postId: 'post-acme-panels', tagId: 'tag-acme-holo', tenantId: 'tenant-acme', updatedAt },
  { createdAt, id: 'post-tag-post-acme-panels-tag-acme-typescript', position: 2, postId: 'post-acme-panels', tagId: 'tag-acme-typescript', tenantId: 'tenant-acme', updatedAt },
  { createdAt, id: 'post-tag-post-acme-release-tag-acme-holo', position: 1, postId: 'post-acme-release', tagId: 'tag-acme-holo', tenantId: 'tenant-acme', updatedAt },
  { createdAt, id: 'post-tag-post-acme-draft-tag-acme-tutorial', position: 1, postId: 'post-acme-draft', tagId: 'tag-acme-tutorial', tenantId: 'tenant-acme', updatedAt },
  { createdAt, id: 'post-tag-post-globex-platform-tag-globex-holo', position: 1, postId: 'post-globex-platform', tagId: 'tag-globex-holo', tenantId: 'tenant-globex', updatedAt },
  { createdAt, id: 'post-tag-post-globex-platform-tag-globex-typescript', position: 2, postId: 'post-globex-platform', tagId: 'tag-globex-typescript', tenantId: 'tenant-globex', updatedAt },
  { createdAt, id: 'post-tag-post-globex-roadmap-tag-globex-tutorial', position: 1, postId: 'post-globex-roadmap', tagId: 'tag-globex-tutorial', tenantId: 'tenant-globex', updatedAt },
  { createdAt, id: 'post-tag-post-globex-draft-tag-globex-holo', position: 1, postId: 'post-globex-draft', tagId: 'tag-globex-holo', tenantId: 'tenant-globex', updatedAt },
])

export const exampleComments = Object.freeze([
  { authorName: 'Ada', body: 'The resource boundaries are clear.', createdAt, id: 'comment-acme-approved', postId: 'post-acme-panels', status: 'approved', tenantId: 'tenant-acme', updatedAt },
  { authorName: 'Grace', body: 'Awaiting Acme moderation.', createdAt, id: 'comment-acme-pending', postId: 'post-acme-panels', status: 'pending', tenantId: 'tenant-acme', updatedAt },
  { authorName: 'Linus', body: 'Globex approved comment.', createdAt, id: 'comment-globex-approved', postId: 'post-globex-platform', status: 'approved', tenantId: 'tenant-globex', updatedAt },
  { authorName: 'Margaret', body: 'Awaiting Globex moderation.', createdAt, id: 'comment-globex-pending', postId: 'post-globex-platform', status: 'pending', tenantId: 'tenant-globex', updatedAt },
])

export function recordsForTenant<TRecord extends { readonly tenantId: string }>(records: readonly TRecord[], tenantId: string): readonly TRecord[] {
  return records.filter(record => record.tenantId === tenantId)
}
