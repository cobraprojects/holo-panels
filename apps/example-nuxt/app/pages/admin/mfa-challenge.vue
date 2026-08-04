<script setup lang="ts">
const code = ref('')
const method = ref<'recovery' | 'totp'>('totp')
const error = ref('')

function cookie(name: string): string {
  const entry = document.cookie.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`))
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : ''
}

async function challenge(): Promise<void> {
  const operation = method.value === 'recovery' ? 'mfa-recovery' : 'mfa-challenge'
  const response = await fetch(`/_holo/panels/admin/auth/${operation}`, {
    body: JSON.stringify({ code: code.value }),
    headers: { 'content-type': 'application/json', 'x-csrf-token': cookie('XSRF-TOKEN') },
    method: 'POST',
  })
  if (!response.ok) return void (error.value = 'MFA challenge failed')
  await navigateTo(response.url, { external: true })
}
</script>

<template>
  <main><h1>MFA challenge</h1><form @submit.prevent="challenge"><label>Challenge method<select v-model="method" name="method"><option value="totp">Authenticator code</option><option value="recovery">Recovery code</option></select></label><label>Authentication code<input v-model="code" name="code" required></label><button type="submit">Verify</button><p v-if="error" role="alert">{{ error }}</p></form></main>
</template>
