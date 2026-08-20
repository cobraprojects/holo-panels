class PostRecord {
  title = ''
  published = false
  publishedAt: Date | null = null
}

class CommentRecord {
  body = ''
}

const Comment = {
  create: (): CommentRecord => new CommentRecord(),
  definition: { relations: {} },
}

const Post = {
  create: (): PostRecord => new PostRecord(),
  definition: {
    name: 'posts',
    primaryKey: 'title',
    relations: { comments: { related: () => Comment } },
    softDeletes: false,
  },
  query: () => ({}),
}

export default Post
