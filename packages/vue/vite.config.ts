import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
        server: fileURLToPath(new URL('./src/server.ts', import.meta.url)),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        /^@holo-js\//u,
        /^@radix-icons\/vue$/u,
        /^@vueuse\/core$/u,
        /^class-variance-authority$/u,
        /^clsx$/u,
        /^lucide-vue-next$/u,
        /^reka-ui$/u,
        /^tailwind-merge$/u,
        /^vue(?:\/|$)/u,
        /^vue-sonner$/u,
      ],
      output: {
        entryFileNames: '[name].mjs',
      },
    },
  },
  plugins: [
    vue(),
    dts({
      include: ['src'],
      processor: 'vue',
      tsconfigPath: './tsconfig.json',
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
