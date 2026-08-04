<template>
  <main class="shell">
    <h1>{{ appName }}</h1>
    <p>Nuxt renders the UI. Holo owns the backend runtime and canonical server directories.</p>
    <NuxtPage />
  </main>
</template>

<script setup lang="ts">
const appName = "example-nuxt"
</script>

<style scoped>
.shell {
  min-height: 100vh;
  display: grid;
  place-content: center;
  gap: 1rem;
  padding: 3rem;
  font-family: sans-serif;
}
h1 {
  margin: 0;
  font-size: clamp(2.5rem, 6vw, 4rem);
}
p {
  margin: 0;
  max-width: 40rem;
  line-height: 1.6;
}
</style>
