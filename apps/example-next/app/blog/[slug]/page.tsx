import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createExampleBlogDomain } from '../../../server/domain/blog'

interface BlogPostProps {
  readonly params: Promise<{ readonly slug: string }>
}

export default async function BlogPost({ params }: BlogPostProps) {
  const { slug } = await params
  const post = createExampleBlogDomain().findPublishedPost('tenant-acme', slug)
  if (!post) notFound()

  return (
    <main style={{ fontFamily: 'sans-serif', margin: '0 auto', maxWidth: '48rem', padding: '3rem 1.5rem' }}>
      <p><Link href="/blog">Back to all posts</Link></p>
      <article>
        <p>{post.category.name} · {post.tags.map(tag => tag.name).join(', ')}</p>
        <h1>{post.title}</h1>
        {post.media ? <img alt={post.media.alt} height="360" src={post.media.url} width="640" /> : null}
        <p>{post.body}</p>
      </article>
      <section aria-labelledby="comments-heading">
        <h2 id="comments-heading">Comments</h2>
        {post.comments.length === 0 ? <p>No approved comments yet.</p> : post.comments.map(comment => (
          <blockquote key={comment.id}>
            <p>{comment.body}</p>
            <footer>— {comment.authorName}</footer>
          </blockquote>
        ))}
      </section>
    </main>
  )
}
