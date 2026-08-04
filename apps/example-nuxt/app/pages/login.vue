<script setup lang="ts">
const email = ref('super@example.test')
const password = ref('panel-secret')
const error = ref('')

function cookie(name: string): string {
  const entry = document.cookie.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`))
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : ''
}

async function login(): Promise<void> {
  error.value = ''
  const response = await fetch('/_holo/panels/admin/auth/login', {
    body: JSON.stringify({ credentials: { email: email.value, password: password.value } }),
    headers: { 'content-type': 'application/json', 'x-csrf-token': cookie('XSRF-TOKEN') },
    method: 'POST',
  })
  if (!response.ok) {
    error.value = 'Login failed'
    return
  }
  await navigateTo(response.url, { external: true })
}
</script>

<template>
  <main><h1>Panel login</h1><form @submit.prevent="login"><label>Email<input v-model="email" name="email" type="email" required></label><label>Password<input v-model="password" name="password" type="password" required></label><button type="submit">Log in</button><p v-if="error" role="alert">{{ error }}</p></form></main>
</template>
