<script lang="ts">
  let tenant = 'acme'
  let error = ''
  let active = ''

  function cookie(name: string): string {
    const entry = document.cookie.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`))
    return entry ? decodeURIComponent(entry.slice(name.length + 1)) : ''
  }

  async function switchTenant(): Promise<void> {
    const response = await fetch('/_holo/panels/admin/tenant/switch', {
      body: JSON.stringify({ routeKey: tenant }),
      headers: { 'content-type': 'application/json', 'x-csrf-token': cookie('XSRF-TOKEN') },
      method: 'POST',
    })
    if (!response.ok) return void (error = 'Tenant switch failed')
    const result = await response.json() as { tenant?: { routeKey?: unknown } }
    active = String(result.tenant?.routeKey ?? '')
  }
</script>

<main><h1>Switch tenant</h1><form onsubmit={(event) => { event.preventDefault(); void switchTenant() }}><label>Tenant<select bind:value={tenant} name="tenant"><option value="acme">Acme</option><option value="globex">Globex</option></select></label><button type="submit">Switch tenant</button>{#if active}<p>Active tenant: {active}</p>{/if}{#if error}<p role="alert">{error}</p>{/if}</form></main>
