import adapter from '@sveltejs/adapter-node'
import { withHoloSvelteKit } from '@holo-js/adapter-sveltekit/config'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

/** @type {import('@sveltejs/kit').Config} */
const config = withHoloSvelteKit({
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter(),
  },
})

export default config
