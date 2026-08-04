<script setup lang="ts">
const tenant = ref('acme')
const error = ref('')
const active = ref('')

function cookie(name: string): string {
  const entry = document.cookie.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`))
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : ''
}

async function switchTenant(): Promise<void> {
  const response = await fetch('/_holo/panels/admin/tenant/switch', {
    body: JSON.stringify({ routeKey: tenant.value }),
    headers: { 'content-type': 'application/json', 'x-csrf-token': cookie('XSRF-TOKEN') },
    method: 'POST',
  })
  if (!response.ok) return void (error.value = 'Tenant switch failed')
  const result = await response.json() as { tenant?: { routeKey?: unknown } }
  active.value = String(result.tenant?.routeKey ?? '')
}
</script>

<template>
  <main><h1>Switch tenant</h1><form @submit.prevent="switchTenant"><label>Tenant<select v-model="tenant" name="tenant"><option value="acme">Acme</option><option value="globex">Globex</option></select></label><button type="submit">Switch tenant</button><p v-if="active">Active tenant: {{ active }}</p><p v-if="error" role="alert">{{ error }}</p></form></main>
</template>
