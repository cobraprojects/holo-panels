<svelte:head><title>example-sveltekit</title></svelte:head>

<script lang="ts">
  const projectName = "example-sveltekit"
</script>

<main class="shell">
  <h1>{projectName}</h1>
  <p>SvelteKit owns rendering. Holo owns config, discovery, and backend runtime services.</p>
</main>

<style>
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
