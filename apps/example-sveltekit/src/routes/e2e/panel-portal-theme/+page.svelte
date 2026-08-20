<script lang="ts">
  import '@holo-js/panels-svelte/style.css'
  import PanelFixture from './PanelFixture.svelte'
</script>

<svelte:head>
  <title>Panel portal theme isolation</title>
</svelte:head>

<main class="hp-main" data-e2e-panel-portal-theme>
  <h1>Panel portal theme isolation</h1>
  <PanelFixture overlay="dropdown" theme="light" />
  <PanelFixture overlay="modal" theme="dark" />
</main>
