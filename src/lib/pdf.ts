import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'

GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).href

export function openPdf(data: Uint8Array) {
  const assets = new URL(import.meta.env.DEV ? './node_modules/pdfjs-dist/' : './pdf-assets/', document.baseURI)
  const resource = (name: string) => new URL(name + '/', assets).href
  return getDocument({
    data,
    cMapUrl: resource('cmaps'),
    cMapPacked: true,
    iccUrl: resource('iccs'),
    standardFontDataUrl: resource('standard_fonts'),
    wasmUrl: resource('wasm'),
    useWorkerFetch: true,
  })
}
