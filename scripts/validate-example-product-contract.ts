import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { exampleSeedData as nextRecords } from '../apps/example-next/server/domain/blog'
import { exampleActors as nuxtActors, exampleDomainRecords as nuxtRecords, exampleTenants as nuxtTenants } from '../apps/example-nuxt/server/admin/domain/fixtures'
import {
  exampleActors as svelteActors,
  exampleCategories as svelteCategories,
  exampleComments as svelteComments,
  exampleMedia as svelteMedia,
  exampleMemberships as svelteMemberships,
  examplePosts as sveltePosts,
  examplePostTags as sveltePostTags,
  exampleTags as svelteTags,
  exampleTenants as svelteTenants,
  exampleUsers as svelteUsers,
} from '../apps/example-sveltekit/server/fixtures/example-domain'

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url))
const tenantIds = ['tenant-acme', 'tenant-globex'] as const
const actorIds = ['user-super-admin', 'user-acme-admin', 'user-acme-editor', 'user-globex-editor', 'user-denied'] as const
const entityIds = ['posts', 'categories', 'tags', 'post-tags', 'comments', 'users', 'memberships', 'media'] as const
const entityClasses = {
  categories: 'Category',
  comments: 'Comment',
  media: 'Media',
  memberships: 'Membership',
  posts: 'Post',
  'post-tags': 'PostTag',
  tags: 'Tag',
  users: 'User',
} as const
const failures: string[] = []

const sorted = <TValue>(values: readonly TValue[]): readonly TValue[] => [...values].sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
const pick = (record: object, keys: readonly string[]): Readonly<Record<string, unknown>> => Object.fromEntries(keys.map(key => [key, Reflect.get(record, key)]))
const comparable = <TRecord extends object>(records: readonly TRecord[], keys: readonly string[]): readonly Readonly<Record<string, unknown>>[] => sorted(records.map(record => pick(record, keys)))
const equal = (label: string, left: unknown, right: unknown): void => {
  if (JSON.stringify(left) !== JSON.stringify(right)) failures.push(`${label} drifted`)
}
const requireFiles = (application: string, files: readonly string[]): void => {
  for (const file of files) if (!existsSync(resolve(repositoryRoot, `apps/${application}`, file))) failures.push(`${application}/${file} is missing`)
}
const forbidFiles = (application: string, files: readonly string[]): void => {
  for (const file of files) if (existsSync(resolve(repositoryRoot, `apps/${application}`, file))) failures.push(`${application}/${file} must not exist`)
}

const nextRelations = nextRecords.posts.flatMap(post => post.tagIds.map(tagId => ({ postId: post.id, tagId, tenantId: post.tenantId })))
const applications = [
  {
    actors: actorIds,
    categories: nextRecords.categories,
    comments: nextRecords.comments,
    media: nextRecords.media,
    memberships: nextRecords.memberships,
    name: 'example-next',
    posts: nextRecords.posts,
    postTags: nextRelations,
    tags: nextRecords.tags,
    tenants: tenantIds,
    users: nextRecords.users,
  },
  {
    actors: nuxtActors.map(actor => actor.id),
    categories: nuxtRecords.categories,
    comments: nuxtRecords.comments,
    media: nuxtRecords.media,
    memberships: nuxtRecords.memberships,
    name: 'example-nuxt',
    posts: nuxtRecords.posts,
    postTags: nuxtRecords.postTags,
    tags: nuxtRecords.tags,
    tenants: nuxtTenants.map(tenant => tenant.id),
    users: nuxtRecords.users,
  },
  {
    actors: Object.keys(svelteActors),
    categories: svelteCategories,
    comments: svelteComments,
    media: svelteMedia,
    memberships: svelteMemberships,
    name: 'example-sveltekit',
    posts: sveltePosts,
    postTags: sveltePostTags,
    tags: svelteTags,
    tenants: svelteTenants.map(tenant => tenant.id),
    users: svelteUsers,
  },
] as const

const fields = {
  categories: ['id', 'name', 'slug', 'tenantId'],
  comments: ['authorName', 'body', 'id', 'postId', 'status', 'tenantId'],
  media: ['alt', 'disk', 'id', 'mime', 'path', 'size', 'tenantId'],
  memberships: ['id', 'roleKey', 'tenantId', 'userId'],
  posts: ['authorId', 'body', 'categoryId', 'excerpt', 'featuredMediaId', 'id', 'slug', 'status', 'tenantId', 'title'],
  postTags: ['postId', 'tagId', 'tenantId'],
  tags: ['id', 'name', 'slug', 'tenantId'],
  users: ['email', 'id', 'name'],
} as const

const baseline = applications[0]
for (const application of applications) {
  equal(`${application.name} tenant IDs`, sorted(application.tenants), sorted(tenantIds))
  equal(`${application.name} actor IDs`, sorted(application.actors), sorted(actorIds))
  for (const key of Object.keys(fields) as (keyof typeof fields)[]) {
    equal(`${application.name} ${key}`, comparable(application[key], fields[key]), comparable(baseline[key], fields[key]))
  }
  for (const tenantId of tenantIds) {
    const counts = {
      categories: application.categories.filter(record => record.tenantId === tenantId).length,
      comments: application.comments.filter(record => record.tenantId === tenantId).length,
      media: application.media.filter(record => record.tenantId === tenantId).length,
      posts: application.posts.filter(record => record.tenantId === tenantId).length,
      tags: application.tags.filter(record => record.tenantId === tenantId).length,
    }
    equal(`${application.name} ${tenantId} seed counts`, counts, { categories: 2, comments: 2, media: 1, posts: 3, tags: 3 })
  }
  for (const media of application.media) if (media.disk !== 'private') failures.push(`${application.name} ${String(media.id)} is not private`)
  for (const post of application.posts) {
    if (!application.categories.some(category => category.id === post.categoryId && category.tenantId === post.tenantId)) failures.push(`${application.name} ${post.id} has a cross-tenant category`)
    if (post.featuredMediaId && !application.media.some(media => media.id === post.featuredMediaId && media.tenantId === post.tenantId)) failures.push(`${application.name} ${post.id} has cross-tenant media`)
  }
  for (const relation of application.postTags) {
    if (!application.posts.some(post => post.id === relation.postId && post.tenantId === relation.tenantId)) failures.push(`${application.name} has a cross-tenant post-tag post`)
    if (!application.tags.some(tag => tag.id === relation.tagId && tag.tenantId === relation.tenantId)) failures.push(`${application.name} has a cross-tenant post-tag tag`)
  }
  requireFiles(application.name, entityIds.map(entityId => `server/models/${entityClasses[entityId]}.ts`))
  requireFiles(application.name, entityIds.map(entityId => `server/admin/resources/${entityId}/${entityClasses[entityId]}Resource.ts`))
}

requireFiles('example-next', [
  'app/admin/[[...panelsPath]]/page.tsx',
  'app/holo/panels/[panelId]/[operation]/route.ts',
  'app/blog/page.tsx',
  'app/blog/[slug]/page.tsx',
  'server/admin/AdminPanel.ts',
  'server/admin/imports/PostImporter.ts',
  'server/admin/exports/PostExporter.ts',
  'server/admin/widgets/ContentOverview.ts',
  'server/db/migrations/2026_07_28_000100_create_notifications.ts',
])
forbidFiles('example-next', [
  'app/%5Fholo/panels/[panelId]/[operation]/route.ts',
  'app/_holo/panels/[panelId]/[operation]/route.ts',
])
requireFiles('example-nuxt', [
  'app/pages/index.vue',
  'app/pages/admin/[[...panelsPath]].vue',
  'server/routes/holo/panels/[panelId]/[operation].ts',
  'app/pages/blog/index.vue',
  'app/pages/blog/[slug].vue',
  'server/admin/AdminPanel.ts',
  'server/admin/imports/PostImporter.ts',
  'server/admin/exports/PostExporter.ts',
  'server/admin/widgets/ContentOverview.ts',
  'server/db/migrations/2026_07_28_000100_create_notifications.ts',
])
requireFiles('example-sveltekit', [
  'src/routes/admin/[...path]/+page.server.ts',
  'src/routes/holo/panels/[panelId]/[operation]/+server.ts',
  'src/routes/blog/+page.server.ts',
  'src/routes/blog/[slug]/+page.server.ts',
  'server/admin/panels/AdminPanel.ts',
  'server/admin/imports/PostImporter.ts',
  'server/admin/exports/PostExporter.ts',
  'server/admin/widgets/ContentOverview.ts',
  'server/db/migrations/2026_07_28_000100_create_notifications.ts',
])

if (failures.length > 0) throw new Error(['Example product contract validation failed:', ...failures.map(failure => `  - ${failure}`)].join('\n'))

process.stdout.write('Validated equivalent stable IDs, entities, roles, tenant boundaries, seed counts, relationships, media, notifications, widgets, transfers, routes, and public blog/admin features for Next.js, Nuxt, and SvelteKit\n')
process.stdout.write('Remaining acceptance work: clean packed-release and external registry installation\n')
