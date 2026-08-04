<script lang="ts">
  let email = 'super@example.test'
  let password = 'panel-secret'
  let error = ''

  function cookie(name: string): string {
    const entry = document.cookie.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`))
    return entry ? decodeURIComponent(entry.slice(name.length + 1)) : ''
  }

  async function login(event: SubmitEvent): Promise<void> {
    event.preventDefault()
    error = ''
    const response = await fetch('/_holo/panels/admin/auth/login', {
      body: JSON.stringify({ credentials: { email, password } }),
      headers: { 'content-type': 'application/json', 'x-csrf-token': cookie('XSRF-TOKEN') },
      method: 'POST',
    })
    if (!response.ok) {
      error = 'Login failed'
      return
    }
    window.location.assign(response.url)
  }
</script>

<main><h1>Panel login</h1><form onsubmit={login}><label>Email<input bind:value={email} name="email" type="email" required></label><label>Password<input bind:value={password} name="password" type="password" required></label><button type="submit">Log in</button>{#if error}<p role="alert">{error}</p>{/if}</form></main>
