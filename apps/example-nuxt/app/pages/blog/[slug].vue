<script setup lang="ts">
import { getExampleBlogPost } from '../../../server/blog'

const route = useRoute()
const tenant = typeof route.query.tenant === 'string' ? route.query.tenant : null
const slug = typeof route.params.slug === 'string' ? route.params.slug : ''
const entry = computed(() => getExampleBlogPost(slug, { tenant }))

if (!entry.value) throw createError({ statusCode: 404, statusMessage: 'Post not found' })
</script>

<template>
  <main v-if="entry">
    <NuxtLink :to="{ path: '/blog', query: { tenant: entry.tenant.routeKey } }">Back to {{ entry.tenant.name }} journal</NuxtLink>
    <article>
      <p>{{ entry.post.category?.name }} · {{ entry.post.tags.map(tag => tag.name).join(', ') }}</p>
      <h1>{{ entry.post.title }}</h1>
      <p>{{ entry.post.body }}</p>
      <p v-if="entry.post.media?.private">Private media is available only inside the authorized panel.</p>
    </article>
    <section aria-labelledby="comments-heading">
      <h2 id="comments-heading">Comments</h2>
      <p v-if="entry.comments.length === 0">No approved comments yet.</p>
      <article v-for="comment in entry.comments" :key="comment.id">
        <h3>{{ comment.authorName }}</h3>
        <p>{{ comment.body }}</p>
      </article>
    </section>
  </main>
</template>

<style scoped>
main { margin: 0 auto; max-width: 48rem; padding: 3rem 1.5rem; font-family: sans-serif; }
article { margin-block: 2rem; }
</style>
