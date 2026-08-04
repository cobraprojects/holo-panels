import Link from 'next/link'
import { createExampleBlogDomain } from '../../server/domain/blog'

interface BlogIndexProps {
  readonly searchParams?: Promise<Readonly<Record<string, string | readonly string[] | undefined>>>
}

const selectedValue = (value: string | readonly string[] | undefined): string | undefined => (
  typeof value === 'string' ? value : value?.[0]
)

export default async function BlogIndex({ searchParams }: BlogIndexProps) {
  const query = await searchParams
  const categorySlug = selectedValue(query?.category)
  const tagSlug = selectedValue(query?.tag)
  const posts = createExampleBlogDomain().listPublishedPosts('tenant-acme', { categorySlug, tagSlug })

  return (
    <main style={{ fontFamily: 'sans-serif', margin: '0 auto', maxWidth: '64rem', padding: '3rem 1.5rem' }}>
      <header>
        <p>Acme publishing</p>
        <h1>Holo Panels example blog</h1>
        <p>Published content is resolved through the same tenant-scoped domain used by the administration example.</p>
      </header>
      <nav aria-label="Blog filters">
        <Link href="/blog">All</Link>{' · '}
        <Link href="/blog?category=guides">Guides</Link>{' · '}
        <Link href="/blog?category=news">News</Link>{' · '}
        <Link href="/blog?tag=holo">Holo</Link>
      </nav>
      <section aria-label="Published posts">
        {posts.length === 0 ? <p role="status">No published posts match these filters.</p> : posts.map(post => (
          <article key={post.id} style={{ borderBlockEnd: '1px solid #d4d4d8', paddingBlock: '2rem' }}>
            {post.media ? <img alt={post.media.alt} height="180" src={post.media.url} width="320" /> : null}
            <p>{post.category.name} · {post.tags.map(tag => tag.name).join(', ')}</p>
            <h2><Link href={`/blog/${post.slug}`}>{post.title}</Link></h2>
            <p>{post.excerpt}</p>
          </article>
        ))}
      </section>
    </main>
  )
}
