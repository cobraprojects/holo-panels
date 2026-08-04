<script lang="ts">
  import type { PageProps } from './$types'

  let { data }: PageProps = $props()
</script>

<svelte:head><title>{data.post.title} · {data.tenant.name}</title></svelte:head>

<main class="post-shell">
  <a href={`/blog?tenant=${encodeURIComponent(data.tenant.routeKey)}`}>← {data.tenant.name} journal</a>
  <article>
    <div class="meta">
      {#if data.post.category}<span>{data.post.category.name}</span>{/if}
      {#each data.post.tags as tag}<span>#{tag.name}</span>{/each}
    </div>
    <h1>{data.post.title}</h1>
    <p class="excerpt">{data.post.excerpt}</p>
    {#if data.post.media?.private}
      <aside>Featured media is private and is not exposed by the public blog response.</aside>
    {/if}
    <div class="body">{data.post.body}</div>
  </article>
  <section aria-labelledby="comments-heading">
    <h2 id="comments-heading">Comments</h2>
    {#if data.comments.length === 0}<p>No approved comments yet.</p>{/if}
    {#each data.comments as comment}
      <blockquote><p>{comment.body}</p><footer>— {comment.authorName}</footer></blockquote>
    {/each}
  </section>
</main>

<style>
  :global(body) { margin: 0; background: #f3efe5; color: #18231c; font-family: Georgia, serif; }
  .post-shell { width: min(48rem, calc(100% - 2rem)); margin: 0 auto; padding: 2rem 0 5rem; }
  .post-shell > a { color: #425449; text-underline-offset: .2em; }
  article { margin: 3rem 0; }
  h1 { margin: .7rem 0 1.5rem; font-size: clamp(3rem, 9vw, 6rem); font-weight: 400; line-height: .95; }
  h2 { margin-top: 3rem; font-size: 2rem; font-weight: 400; }
  .meta { display: flex; gap: .7rem; color: #59665c; font: 700 .75rem/1.2 system-ui; letter-spacing: .1em; text-transform: uppercase; }
  .excerpt { font-size: 1.35rem; color: #425449; }
  .body { margin-top: 2rem; font-size: 1.1rem; line-height: 1.8; white-space: pre-wrap; }
  aside, blockquote { margin: 1.5rem 0; border-left: .2rem solid #8f5b3e; padding: 1rem 1.25rem; background: #f8f5ed; }
  blockquote footer { color: #59665c; }
</style>
