<script setup lang="ts">
const enabled = ref(false)
const manualKey = ref('')
const recoveryCodes = ref<readonly string[]>([])
const enrollmentCode = ref('')
const disableCode = ref('')
const disableMethod = ref<'recovery' | 'totp'>('totp')
const error = ref('')

function cookie(name: string): string {
  const entry = document.cookie.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`))
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : ''
}

async function authRequest(operation: string, payload?: object): Promise<Response> {
  return fetch(`/_holo/panels/admin/auth/${operation}`, payload ? {
    body: JSON.stringify(payload),
    headers: { 'content-type': 'application/json', 'x-csrf-token': cookie('XSRF-TOKEN') },
    method: 'POST',
  } : { method: 'GET' })
}

onMounted(async () => {
  const response = await authRequest('mfa-status')
  if (response.ok) enabled.value = Boolean((await response.json() as { enabled?: unknown }).enabled)
})

async function begin(): Promise<void> {
  const response = await authRequest('mfa-enrollment-begin')
  if (!response.ok) return void (error.value = 'MFA enrollment failed')
  manualKey.value = String((await response.json() as { manualKey?: unknown }).manualKey ?? '')
}

async function confirm(): Promise<void> {
  const response = await authRequest('mfa-enrollment-confirm', { code: enrollmentCode.value })
  if (!response.ok) return void (error.value = 'MFA confirmation failed')
  const result = await response.json() as { recoveryCodes?: unknown }
  recoveryCodes.value = Array.isArray(result.recoveryCodes) ? result.recoveryCodes.map(String) : []
  enabled.value = true
}

async function disable(): Promise<void> {
  const response = await authRequest('mfa-disable', { code: disableCode.value, method: disableMethod.value })
  if (!response.ok) return void (error.value = 'MFA disable failed')
  enabled.value = false
  manualKey.value = ''
  recoveryCodes.value = []
}
</script>

<template>
  <main><h1>Multi-factor authentication</h1><p>MFA is {{ enabled ? 'enabled' : 'disabled' }}.</p><button v-if="!enabled && !manualKey" type="button" @click="begin">Begin enrollment</button><template v-if="manualKey"><p>Manual key: <code data-testid="mfa-manual-key">{{ manualKey }}</code></p><form @submit.prevent="confirm"><label>Authentication code<input v-model="enrollmentCode" name="code" inputmode="numeric" required></label><button type="submit">Confirm enrollment</button></form></template><section v-if="recoveryCodes.length" aria-label="Recovery codes"><h2>Recovery codes</h2><ul><li v-for="code in recoveryCodes" :key="code">{{ code }}</li></ul></section><form v-if="enabled" @submit.prevent="disable"><label>Disable method<select v-model="disableMethod" name="method"><option value="totp">Authenticator code</option><option value="recovery">Recovery code</option></select></label><label>Disable code<input v-model="disableCode" name="code" required></label><button type="submit">Disable MFA</button></form><p v-if="error" role="alert">{{ error }}</p></main>
</template>
