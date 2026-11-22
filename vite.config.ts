import { readFileSync, readdirSync } from 'node:fs'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const pdfAssets = new URL('./node_modules/pdfjs-dist/', import.meta.url)

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), {
    name: 'pdf-reader-assets',
    apply: 'build',
    generateBundle() {
      const emit = (name: string) => this.emitFile({
        type: 'asset',
        fileName: 'pdf-assets/' + name,
        source: readFileSync(new URL(name, pdfAssets)),
      })
      emit('LICENSE')
      for (const folder of ['cmaps', 'iccs', 'standard_fonts', 'wasm']) {
        for (const file of readdirSync(new URL(folder, pdfAssets))) emit(folder + '/' + file)
      }
    },
  }],
})
