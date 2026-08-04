<script lang="ts">
  import type { PageProps } from './$types'

  let { data }: PageProps = $props()

  const query = (values: Readonly<Record<string, string | null>>): string => {
    const parameters = new URLSearchParams()
    for (const [key, value] of Object.entries(values)) if (value) parameters.set(key, value)
    return parameters.toString()
  }
</script>

<svelte:head><title>{data.tenant.name} blog · Holo Panels</title></svelte:head>

<main class="blog-shell">
  <header class="blog-header">
    <div>
      <a class="eyebrow" href="/">Holo Panels example</a>
      <h1>{data.tenant.name} journal</h1>
      <p>Published records, categories, tags, approved comments, and private-media boundaries.</p>
    </div>
    <nav aria-label="Tenant publications">
      {#each data.tenants as tenant}
        <a aria-current={tenant.routeKey === data.tenant.routeKey ? 'page' : undefined} href={`/blog?${query({ tenant: tenant.routeKey })}`}>{tenant.name}</a>
      {/each}
    </nav>
  </header>

  <section class="filters" aria-label="Blog filters">
    <a class:active={!data.activeFilters.category && !data.activeFilters.tag} href={`/blog?${query({ tenant: data.tenant.routeKey })}`}>All</a>
    {#each data.categories as category}
      <a class:active={data.activeFilters.category === category.slug} href={`/blog?${query({ category: category.slug, tenant: data.tenant.routeKey })}`}>{category.name}</a>
    {/each}
    {#each data.tags as tag}
      <a class:active={data.activeFilters.tag === tag.slug} href={`/blog?${query({ tag: tag.slug, tenant: data.tenant.routeKey })}`}>#{tag.name}</a>
    {/each}
  </section>

  {#if data.posts.length === 0}
    <p class="empty" role="status">No published posts match these filters.</p>
  {:else}
    <section class="post-grid" aria-label="Published posts">
      {#each data.posts as post}
        <article>
          <div class="meta">
            {#if post.category}<span>{post.category.name}</span>{/if}
            {#each post.tags as tag}<span>#{tag.name}</span>{/each}
          </div>
          <h2><a href={`/blog/${post.slug}?${query({ tenant: data.tenant.routeKey })}`}>{post.title}</a></h2>
          <p>{post.excerpt}</p>
          {#if post.media?.private}<p class="private-media">Private media is available only inside the authorized panel.</p>{/if}
        </article>
      {/each}
    </section>
  {/if}
</main>

<style>
  :global(body) { margin: 0; background: #f3efe5; color: #18231c; font-family: Georgia, serif; }
  .blog-shell { width: min(72rem, calc(100% - 2rem)); margin: 0 auto; padding: 3rem 0 5rem; }
  .blog-header { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 2rem; align-items: end; border-bottom: 1px solid #879283; padding-bottom: 2rem; }
  .eyebrow { color: #58645a; font: 700 .75rem/1.2 system-ui; letter-spacing: .14em; text-transform: uppercase; }
  h1 { max-width: 12ch; margin: .6rem 0; font-size: clamp(3rem, 8vw, 6.5rem); font-weight: 400; line-height: .9; }
  h2 { margin: .75rem 0; font-size: 2rem; font-weight: 400; }
  p { line-height: 1.65; }
  nav, .filters, .meta { display: flex; flex-wrap: wrap; gap: .65rem; }
  a { color: inherit; text-underline-offset: .22em; }
  nav a, .filters a { border: 1px solid #879283; border-radius: 999px; padding: .5rem .8rem; font: 600 .8rem/1 system-ui; text-decoration: none; }
  nav a[aria-current='page'], .filters a.active { background: #243c2e; color: #f8f5ed; }
  .filters { padding: 1.5rem 0; }
  .post-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr)); gap: 1px; background: #879283; border: 1px solid #879283; }
  article { min-height: 17rem; padding: 1.5rem; background: #f8f5ed; }
  .meta { color: #59665c; font: 600 .72rem/1.2 system-ui; letter-spacing: .08em; text-transform: uppercase; }
  .private-media, .empty { color: #59665c; font-style: italic; }
  @media (max-width: 42rem) { .blog-header { grid-template-columns: 1fr; } }
</style>
