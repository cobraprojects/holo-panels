<script setup lang="ts">
import { getExampleBlogIndex } from '../../../server/blog'

const route = useRoute()
const value = (input: unknown): string | null => typeof input === 'string' ? input : null
const blog = computed(() => getExampleBlogIndex({
  category: value(route.query.category),
  tag: value(route.query.tag),
  tenant: value(route.query.tenant),
}))
</script>

<template>
  <main>
    <header>
      <p>Holo Panels example</p>
      <h1>{{ blog.tenant.name }} journal</h1>
      <p>Published records are resolved from the tenant-scoped example domain.</p>
    </header>
    <nav aria-label="Tenant publications">
      <NuxtLink v-for="tenant in blog.tenants" :key="tenant.routeKey" :to="{ path: '/blog', query: { tenant: tenant.routeKey } }">
        {{ tenant.name }}
      </NuxtLink>
    </nav>
    <nav aria-label="Blog filters">
      <NuxtLink :to="{ path: '/blog', query: { tenant: blog.tenant.routeKey } }">All</NuxtLink>
      <NuxtLink v-for="category in blog.categories" :key="category.slug" :to="{ path: '/blog', query: { category: category.slug, tenant: blog.tenant.routeKey } }">
        {{ category.name }}
      </NuxtLink>
      <NuxtLink v-for="tag in blog.tags" :key="tag.slug" :to="{ path: '/blog', query: { tag: tag.slug, tenant: blog.tenant.routeKey } }">
        #{{ tag.name }}
      </NuxtLink>
    </nav>
    <p v-if="blog.posts.length === 0" role="status">No published posts match these filters.</p>
    <section v-else aria-label="Published posts">
      <article v-for="post in blog.posts" :key="post.slug">
        <p>{{ post.category?.name }} · {{ post.tags.map(tag => tag.name).join(', ') }}</p>
        <h2><NuxtLink :to="{ path: `/blog/${post.slug}`, query: { tenant: blog.tenant.routeKey } }">{{ post.title }}</NuxtLink></h2>
        <p>{{ post.excerpt }}</p>
        <p v-if="post.media?.private">Private media is available only inside the authorized panel.</p>
      </article>
    </section>
  </main>
</template>

<style scoped>
main { margin: 0 auto; max-width: 64rem; padding: 3rem 1.5rem; font-family: sans-serif; }
nav { display: flex; flex-wrap: wrap; gap: 1rem; margin: 1rem 0; }
article { border-block-end: 1px solid #d4d4d8; padding-block: 2rem; }
</style>
