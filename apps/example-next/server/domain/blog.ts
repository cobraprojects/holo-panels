export type ExampleRoleKey = 'editor' | 'super-admin' | 'tenant-admin'
export type ExampleCommentStatus = 'approved' | 'pending' | 'spam'
export type ExamplePostStatus = 'draft' | 'published'

export class ExampleActor {
  declare readonly id: string
  declare readonly role: ExampleRoleKey
  declare readonly tenantId: string
}

export interface ExampleCategory {
  readonly id: string
  readonly name: string
  readonly slug: string
  readonly tenantId: string
}

export interface ExampleTag {
  readonly id: string
  readonly name: string
  readonly slug: string
  readonly tenantId: string
}

export interface ExampleComment {
  readonly authorName: string
  readonly body: string
  readonly id: string
  readonly postId: string
  readonly status: ExampleCommentStatus
  readonly tenantId: string
}

export interface ExampleMedia {
  readonly alt: string
  readonly disk: string
  readonly id: string
  readonly mime: string
  readonly path: string
  readonly size: number
  readonly tenantId: string
}

export interface ExampleMembership {
  readonly id: string
  readonly roleKey: ExampleRoleKey
  readonly tenantId: string
  readonly userId: string
}

export interface ExampleUser {
  readonly email: string
  readonly id: string
  readonly name: string
}

export interface ExamplePost {
  readonly authorId: string
  readonly body: string
  readonly categoryId: string
  readonly createdAt: string
  readonly excerpt: string
  readonly featuredMediaId: string | null
  readonly id: string
  readonly publishedAt: string | null
  readonly slug: string
  readonly status: ExamplePostStatus
  readonly tagIds: readonly string[]
  readonly tenantId: string
  readonly title: string
  readonly updatedAt: string
}

export interface ExampleNotification {
  readonly body: string
  readonly id: string
  readonly readAt: string | null
  readonly recipientId: string
  readonly tenantId: string
  readonly title: string
}

export interface ExampleBlogMedia {
  readonly alt: string
  readonly id: string
  readonly mime: string
  readonly size: number
  readonly url: string
}

export interface ExampleBlogPost extends ExamplePost {
  readonly category: ExampleCategory
  readonly comments: readonly ExampleComment[]
  readonly media: ExampleBlogMedia | null
  readonly tags: readonly ExampleTag[]
}

export interface ExampleAdminSnapshot {
  readonly categories: readonly ExampleCategory[]
  readonly comments: readonly ExampleComment[]
  readonly media: readonly ExampleMedia[]
  readonly memberships: readonly ExampleMembership[]
  readonly notifications: readonly ExampleNotification[]
  readonly posts: readonly ExamplePost[]
  readonly tags: readonly ExampleTag[]
  readonly users: readonly ExampleUser[]
}

export class ExampleDomainAccessError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ExampleDomainAccessError'
  }
}

const categories: readonly ExampleCategory[] = Object.freeze([
  { id: 'category-acme-news', name: 'News', slug: 'news', tenantId: 'tenant-acme' },
  { id: 'category-acme-guides', name: 'Guides', slug: 'guides', tenantId: 'tenant-acme' },
  { id: 'category-globex-news', name: 'News', slug: 'news', tenantId: 'tenant-globex' },
  { id: 'category-globex-guides', name: 'Guides', slug: 'guides', tenantId: 'tenant-globex' },
])

const tags: readonly ExampleTag[] = Object.freeze([
  { id: 'tag-acme-holo', name: 'Holo', slug: 'holo', tenantId: 'tenant-acme' },
  { id: 'tag-acme-typescript', name: 'TypeScript', slug: 'typescript', tenantId: 'tenant-acme' },
  { id: 'tag-acme-tutorial', name: 'Tutorial', slug: 'tutorial', tenantId: 'tenant-acme' },
  { id: 'tag-globex-holo', name: 'Holo', slug: 'holo', tenantId: 'tenant-globex' },
  { id: 'tag-globex-typescript', name: 'TypeScript', slug: 'typescript', tenantId: 'tenant-globex' },
  { id: 'tag-globex-tutorial', name: 'Tutorial', slug: 'tutorial', tenantId: 'tenant-globex' },
])

const users: readonly ExampleUser[] = Object.freeze([
  { email: 'super@example.test', id: 'user-super-admin', name: 'Super Admin' },
  { email: 'admin@acme.example.test', id: 'user-acme-admin', name: 'Acme Admin' },
  { email: 'editor@acme.example.test', id: 'user-acme-editor', name: 'Acme Editor' },
  { email: 'editor@globex.example.test', id: 'user-globex-editor', name: 'Globex Editor' },
  { email: 'denied@example.test', id: 'user-denied', name: 'Denied User' },
])

const memberships: readonly ExampleMembership[] = Object.freeze([
  { id: 'membership-super-acme', roleKey: 'super-admin', tenantId: 'tenant-acme', userId: 'user-super-admin' },
  { id: 'membership-super-globex', roleKey: 'super-admin', tenantId: 'tenant-globex', userId: 'user-super-admin' },
  { id: 'membership-acme-admin', roleKey: 'tenant-admin', tenantId: 'tenant-acme', userId: 'user-acme-admin' },
  { id: 'membership-acme-editor', roleKey: 'editor', tenantId: 'tenant-acme', userId: 'user-acme-editor' },
  { id: 'membership-globex-editor', roleKey: 'editor', tenantId: 'tenant-globex', userId: 'user-globex-editor' },
])

const timestamp = '2026-07-27T10:00:00.000Z'

const posts: readonly ExamplePost[] = Object.freeze([
  {
    authorId: 'user-acme-editor',
    body: 'Build administrative applications with typed resources and framework-native rendering.',
    categoryId: 'category-acme-guides',
    createdAt: timestamp,
    excerpt: 'A practical introduction to Holo Panels.',
    featuredMediaId: 'media-acme-cover',
    id: 'post-acme-panels',
    publishedAt: timestamp,
    slug: 'building-with-holo-panels',
    status: 'published',
    tagIds: ['tag-acme-holo', 'tag-acme-typescript'],
    tenantId: 'tenant-acme',
    title: 'Building with Holo Panels',
    updatedAt: timestamp,
  },
  {
    authorId: 'user-acme-editor',
    body: 'A stable release is ready for Acme readers.',
    categoryId: 'category-acme-news',
    createdAt: timestamp,
    excerpt: 'Acme release news.',
    featuredMediaId: null,
    id: 'post-acme-release',
    publishedAt: timestamp,
    slug: 'acme-release',
    status: 'published',
    tagIds: ['tag-acme-holo'],
    tenantId: 'tenant-acme',
    title: 'Acme release',
    updatedAt: timestamp,
  },
  {
    authorId: 'user-acme-editor',
    body: 'This draft must never appear on the public blog.',
    categoryId: 'category-acme-news',
    createdAt: timestamp,
    excerpt: 'An unpublished Acme draft.',
    featuredMediaId: null,
    id: 'post-acme-draft',
    publishedAt: null,
    slug: 'acme-draft',
    status: 'draft',
    tagIds: ['tag-acme-tutorial'],
    tenantId: 'tenant-acme',
    title: 'Acme draft',
    updatedAt: timestamp,
  },
  {
    authorId: 'user-globex-editor',
    body: 'Globex uses an isolated panel and content catalog.',
    categoryId: 'category-globex-guides',
    createdAt: timestamp,
    excerpt: 'A Globex platform guide.',
    featuredMediaId: 'media-globex-cover',
    id: 'post-globex-platform',
    publishedAt: timestamp,
    slug: 'globex-platform',
    status: 'published',
    tagIds: ['tag-globex-holo', 'tag-globex-typescript'],
    tenantId: 'tenant-globex',
    title: 'Globex platform',
    updatedAt: timestamp,
  },
  {
    authorId: 'user-globex-editor',
    body: 'Globex roadmap details remain within Globex.',
    categoryId: 'category-globex-news',
    createdAt: timestamp,
    excerpt: 'Globex roadmap news.',
    featuredMediaId: null,
    id: 'post-globex-roadmap',
    publishedAt: timestamp,
    slug: 'globex-roadmap',
    status: 'published',
    tagIds: ['tag-globex-tutorial'],
    tenantId: 'tenant-globex',
    title: 'Globex roadmap',
    updatedAt: timestamp,
  },
  {
    authorId: 'user-globex-editor',
    body: 'This Globex draft is private.',
    categoryId: 'category-globex-news',
    createdAt: timestamp,
    excerpt: 'An unpublished Globex draft.',
    featuredMediaId: null,
    id: 'post-globex-draft',
    publishedAt: null,
    slug: 'globex-draft',
    status: 'draft',
    tagIds: ['tag-globex-holo'],
    tenantId: 'tenant-globex',
    title: 'Globex draft',
    updatedAt: timestamp,
  },
])

const comments: readonly ExampleComment[] = Object.freeze([
  { authorName: 'Ada', body: 'The resource boundaries are clear.', id: 'comment-acme-approved', postId: 'post-acme-panels', status: 'approved', tenantId: 'tenant-acme' },
  { authorName: 'Grace', body: 'Awaiting Acme moderation.', id: 'comment-acme-pending', postId: 'post-acme-panels', status: 'pending', tenantId: 'tenant-acme' },
  { authorName: 'Linus', body: 'Globex approved comment.', id: 'comment-globex-approved', postId: 'post-globex-platform', status: 'approved', tenantId: 'tenant-globex' },
  { authorName: 'Margaret', body: 'Awaiting Globex moderation.', id: 'comment-globex-pending', postId: 'post-globex-platform', status: 'pending', tenantId: 'tenant-globex' },
])

const media: readonly ExampleMedia[] = Object.freeze([
  { alt: 'Layered translucent panels', disk: 'private', id: 'media-acme-cover', mime: 'image/svg+xml', path: 'tenant-acme/posts/panels-cover.svg', size: 318, tenantId: 'tenant-acme' },
  { alt: 'Globex geometric cover', disk: 'private', id: 'media-globex-cover', mime: 'image/svg+xml', path: 'tenant-globex/posts/platform-cover.svg', size: 304, tenantId: 'tenant-globex' },
])

const notifications: readonly ExampleNotification[] = Object.freeze([
  { body: 'An Acme comment is waiting for review.', id: 'notification-acme-pending', readAt: null, recipientId: 'user-acme-editor', tenantId: 'tenant-acme', title: 'Comment pending' },
  { body: 'A Globex comment is waiting for review.', id: 'notification-globex-pending', readAt: null, recipientId: 'user-globex-editor', tenantId: 'tenant-globex', title: 'Comment pending' },
])

export const exampleSeedData = Object.freeze({
  categories,
  comments,
  media,
  memberships,
  posts,
  tags,
  users,
})

const clonePost = (post: ExamplePost) => ({ ...post, tagIds: [...post.tagIds] })

export const exampleActors = Object.freeze({
  acmeAdmin: { id: 'user-acme-admin', role: 'tenant-admin', tenantId: 'tenant-acme' } satisfies ExampleActor,
  acmeEditor: { id: 'user-acme-editor', role: 'editor', tenantId: 'tenant-acme' } satisfies ExampleActor,
  globexEditor: { id: 'user-globex-editor', role: 'editor', tenantId: 'tenant-globex' } satisfies ExampleActor,
  superAdmin: { id: 'user-super-admin', role: 'super-admin', tenantId: 'tenant-acme' } satisfies ExampleActor,
})

export class ExampleBlogDomain {
  readonly #categories = categories.map(category => ({ ...category }))
  readonly #comments = comments.map(comment => ({ ...comment }))
  readonly #media = media.map(asset => ({ ...asset }))
  readonly #memberships = memberships.map(membership => ({ ...membership }))
  readonly #notifications = notifications.map(notification => ({ ...notification }))
  readonly #posts = posts.map(clonePost)
  readonly #tags = tags.map(tag => ({ ...tag }))
  readonly #users = users.map(user => ({ ...user }))

  listPublishedPosts(
    tenantId: string,
    filters: { readonly categorySlug?: string, readonly tagSlug?: string } = {},
  ): readonly ExampleBlogPost[] {
    return this.#posts
      .filter(post => post.tenantId === tenantId && post.status === 'published')
      .map(post => this.#presentPost(post))
      .filter(post => !filters.categorySlug || post.category.slug === filters.categorySlug)
      .filter(post => !filters.tagSlug || post.tags.some(tag => tag.slug === filters.tagSlug))
  }

  findPublishedPost(tenantId: string, slug: string): ExampleBlogPost | null {
    const post = this.#posts.find(candidate => (
      candidate.tenantId === tenantId
      && candidate.slug === slug
      && candidate.status === 'published'
    ))
    return post ? this.#presentPost(post) : null
  }

  findPublicMedia(tenantId: string, mediaId: string): ExampleBlogMedia | null {
    const post = this.#posts.find(candidate => (
      candidate.tenantId === tenantId
      && candidate.featuredMediaId === mediaId
      && candidate.status === 'published'
    ))
    const asset = post
      ? this.#media.find(candidate => candidate.id === mediaId && candidate.tenantId === tenantId)
      : undefined
    return asset ? this.#presentMedia(asset) : null
  }

  adminSnapshot(actor: ExampleActor): ExampleAdminSnapshot {
    this.#requireContentManager(actor)
    const tenant = <TRecord extends { readonly tenantId: string }>(records: readonly TRecord[]): readonly TRecord[] => (
      records.filter(record => record.tenantId === actor.tenantId)
    )
    const mayAdministerUsers = actor.role === 'super-admin' || actor.role === 'tenant-admin'
    const tenantMemberships = tenant(this.#memberships)
    const tenantUserIds = new Set(tenantMemberships.map(membership => membership.userId))

    return Object.freeze({
      categories: tenant(this.#categories),
      comments: tenant(this.#comments),
      media: tenant(this.#media),
      memberships: mayAdministerUsers ? tenantMemberships : [],
      notifications: tenant(this.#notifications).filter(notification => notification.recipientId === actor.id),
      posts: tenant(this.#posts),
      tags: tenant(this.#tags),
      users: mayAdministerUsers ? this.#users.filter(user => tenantUserIds.has(user.id)) : [],
    })
  }

  attachTag(actor: ExampleActor, postId: string, tagId: string): ExamplePost {
    this.#requireContentManager(actor)
    const post = this.#tenantRecord(this.#posts, postId, actor.tenantId, 'Post')
    this.#tenantRecord(this.#tags, tagId, actor.tenantId, 'Tag')
    if (!post.tagIds.includes(tagId)) post.tagIds = [...post.tagIds, tagId]
    return clonePost(post)
  }

  detachTag(actor: ExampleActor, postId: string, tagId: string): ExamplePost {
    this.#requireContentManager(actor)
    const post = this.#tenantRecord(this.#posts, postId, actor.tenantId, 'Post')
    post.tagIds = post.tagIds.filter(candidate => candidate !== tagId)
    return clonePost(post)
  }

  createComment(actor: ExampleActor, postId: string, authorName: string, body: string): ExampleComment {
    this.#requireContentManager(actor)
    this.#tenantRecord(this.#posts, postId, actor.tenantId, 'Post')
    if (!authorName.trim() || !body.trim()) throw new TypeError('Comments require an author and body.')
    const comment = {
      authorName: authorName.trim(),
      body: body.trim(),
      id: `comment-${actor.tenantId}-${this.#comments.length + 1}`,
      postId,
      status: 'pending' as const,
      tenantId: actor.tenantId,
    }
    this.#comments.push(comment)
    return { ...comment }
  }

  saveCategory(actor: ExampleActor, id: string | null, name: string, slug: string): ExampleCategory {
    this.#requireContentManager(actor)
    const values = this.#namedValues(name, slug, 'Category')
    const duplicate = this.#categories.find(category => category.tenantId === actor.tenantId && category.slug === values.slug && category.id !== id)
    if (duplicate) throw new TypeError('Category slugs must be unique within the tenant.')
    if (id) {
      const category = this.#tenantRecord(this.#categories, id, actor.tenantId, 'Category')
      category.name = values.name
      category.slug = values.slug
      return { ...category }
    }
    const category = { id: `category-${this.#tenantRoute(actor.tenantId)}-${values.slug}`, name: values.name, slug: values.slug, tenantId: actor.tenantId }
    this.#categories.push(category)
    return { ...category }
  }

  deleteCategory(actor: ExampleActor, id: string): void {
    this.#requireContentManager(actor)
    const category = this.#tenantRecord(this.#categories, id, actor.tenantId, 'Category')
    if (this.#posts.some(post => post.tenantId === actor.tenantId && post.categoryId === category.id)) throw new TypeError('Categories assigned to posts cannot be deleted.')
    this.#removeRecord(this.#categories, category)
  }

  saveTag(actor: ExampleActor, id: string | null, name: string, slug: string): ExampleTag {
    this.#requireContentManager(actor)
    const values = this.#namedValues(name, slug, 'Tag')
    const duplicate = this.#tags.find(tag => tag.tenantId === actor.tenantId && tag.slug === values.slug && tag.id !== id)
    if (duplicate) throw new TypeError('Tag slugs must be unique within the tenant.')
    if (id) {
      const tag = this.#tenantRecord(this.#tags, id, actor.tenantId, 'Tag')
      tag.name = values.name
      tag.slug = values.slug
      return { ...tag }
    }
    const tag = { id: `tag-${this.#tenantRoute(actor.tenantId)}-${values.slug}`, name: values.name, slug: values.slug, tenantId: actor.tenantId }
    this.#tags.push(tag)
    return { ...tag }
  }

  deleteTag(actor: ExampleActor, id: string): void {
    this.#requireContentManager(actor)
    const tag = this.#tenantRecord(this.#tags, id, actor.tenantId, 'Tag')
    if (this.#posts.some(post => post.tenantId === actor.tenantId && post.tagIds.includes(tag.id))) throw new TypeError('Tags assigned to posts cannot be deleted.')
    this.#removeRecord(this.#tags, tag)
  }

  saveComment(
    actor: ExampleActor,
    id: string | null,
    values: Readonly<{ authorName: string, body: string, postId: string, status: ExampleCommentStatus }>,
  ): ExampleComment {
    this.#requireContentManager(actor)
    this.#tenantRecord(this.#posts, values.postId, actor.tenantId, 'Post')
    if (!values.authorName.trim() || !values.body.trim()) throw new TypeError('Comments require an author and body.')
    if (id) {
      const comment = this.#tenantRecord(this.#comments, id, actor.tenantId, 'Comment')
      Object.assign(comment, { ...values, authorName: values.authorName.trim(), body: values.body.trim() })
      return { ...comment }
    }
    const comment = {
      ...values,
      authorName: values.authorName.trim(),
      body: values.body.trim(),
      id: `comment-${this.#tenantRoute(actor.tenantId)}-${this.#comments.length + 1}`,
      tenantId: actor.tenantId,
    }
    this.#comments.push(comment)
    return { ...comment }
  }

  deleteComment(actor: ExampleActor, id: string): void {
    this.#requireContentManager(actor)
    this.#removeRecord(this.#comments, this.#tenantRecord(this.#comments, id, actor.tenantId, 'Comment'))
  }

  updateMediaAlt(actor: ExampleActor, id: string, alt: string): ExampleMedia {
    this.#requireContentManager(actor)
    if (!alt.trim()) throw new TypeError('Media alternative text is required.')
    const asset = this.#tenantRecord(this.#media, id, actor.tenantId, 'Media')
    asset.alt = alt.trim()
    return { ...asset }
  }

  moderateComment(actor: ExampleActor, commentId: string, status: ExampleCommentStatus): ExampleComment {
    this.#requireContentManager(actor)
    const comment = this.#tenantRecord(this.#comments, commentId, actor.tenantId, 'Comment')
    comment.status = status
    return { ...comment }
  }

  markNotificationRead(actor: ExampleActor, notificationId: string, readAt: string): ExampleNotification {
    const notification = this.#notifications.find(candidate => candidate.id === notificationId)
    if (!notification || notification.tenantId !== actor.tenantId || notification.recipientId !== actor.id) {
      throw new ExampleDomainAccessError('Notification access was denied.')
    }
    notification.readAt = readAt
    return { ...notification }
  }

  #presentMedia(asset: ExampleMedia): ExampleBlogMedia {
    return Object.freeze({
      alt: asset.alt,
      id: asset.id,
      mime: asset.mime,
      size: asset.size,
      url: `/blog/media/${encodeURIComponent(asset.id)}`,
    })
  }

  #presentPost(post: ExamplePost): ExampleBlogPost {
    const category = this.#categories.find(candidate => (
      candidate.id === post.categoryId && candidate.tenantId === post.tenantId
    ))
    if (!category) throw new Error(`Post ${post.id} has no tenant-safe category.`)
    const postTags = this.#tags.filter(tag => post.tagIds.includes(tag.id) && tag.tenantId === post.tenantId)
    const asset = this.#media.find(candidate => candidate.id === post.featuredMediaId && candidate.tenantId === post.tenantId)
    const postComments = this.#comments.filter(comment => (
      comment.postId === post.id
      && comment.tenantId === post.tenantId
      && comment.status === 'approved'
    ))
    return Object.freeze({
      ...clonePost(post),
      category: { ...category },
      comments: postComments.map(comment => ({ ...comment })),
      media: asset ? this.#presentMedia(asset) : null,
      tags: postTags.map(tag => ({ ...tag })),
    })
  }

  #requireContentManager(actor: ExampleActor): void {
    const membership = this.#memberships.find(candidate => (
      candidate.userId === actor.id
      && candidate.tenantId === actor.tenantId
      && candidate.roleKey === actor.role
    ))
    if (!membership) throw new ExampleDomainAccessError('Content administration access was denied.')
  }

  #namedValues(name: string, slug: string, subject: string): { readonly name: string, readonly slug: string } {
    const normalizedName = name.trim()
    const normalizedSlug = slug.trim().toLowerCase()
    if (!normalizedName || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(normalizedSlug)) throw new TypeError(`${subject} names and normalized slugs are required.`)
    return { name: normalizedName, slug: normalizedSlug }
  }

  #removeRecord<TRecord>(records: TRecord[], record: TRecord): void {
    const index = records.indexOf(record)
    if (index >= 0) records.splice(index, 1)
  }

  #tenantRoute(tenantId: string): string {
    return tenantId.replace(/^tenant-/u, '')
  }

  #tenantRecord<TRecord extends { readonly id: string, readonly tenantId: string }>(
    records: readonly TRecord[],
    id: string,
    tenantId: string,
    subject: string,
  ): TRecord {
    const record = records.find(candidate => candidate.id === id && candidate.tenantId === tenantId)
    if (!record) throw new ExampleDomainAccessError(`${subject} access was denied.`)
    return record
  }
}

export const createExampleBlogDomain = (): ExampleBlogDomain => new ExampleBlogDomain()
