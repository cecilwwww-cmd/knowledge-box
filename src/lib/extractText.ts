import mammoth from 'mammoth'
import * as pdfjs from 'pdfjs-dist'
import { createWorker } from 'tesseract.js'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

export type ExtractResult = {
  textContent: string
  dataUrl?: string
  kind: 'text' | 'html' | 'pdf' | 'word' | 'image' | 'unknown'
}

function isHtml(file: File) {
  const name = file.name.toLowerCase()
  return (
    name.endsWith('.html') ||
    name.endsWith('.htm') ||
    file.type === 'text/html'
  )
}

function isPdf(file: File) {
  const name = file.name.toLowerCase()
  return name.endsWith('.pdf') || file.type === 'application/pdf'
}

function isWord(file: File) {
  const name = file.name.toLowerCase()
  return (
    name.endsWith('.docx') ||
    name.endsWith('.doc') ||
    file.type ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.type === 'application/msword'
  )
}

function isImage(file: File) {
  return file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/i.test(file.name)
}

function isPlainText(file: File) {
  const name = file.name.toLowerCase()
  return (
    file.type.startsWith('text/') ||
    name.endsWith('.md') ||
    name.endsWith('.txt') ||
    name.endsWith('.csv') ||
    name.endsWith('.json') ||
    name.endsWith('.ts') ||
    name.endsWith('.tsx') ||
    name.endsWith('.js') ||
    name.endsWith('.py')
  )
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|h[1-6]|li|tr|br)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

async function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('读取文件失败'))
    reader.readAsDataURL(file)
  })
}

async function extractPdf(file: File): Promise<string> {
  const data = new Uint8Array(await file.arrayBuffer())
  const pdf = await pdfjs.getDocument({ data }).promise
  const pages: string[] = []
  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const line = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (line) pages.push(`## 第 ${i} 页\n${line}`)
  }
  const text = pages.join('\n\n').trim()
  if (!text) {
    return `[PDF: ${file.name}] 未提取到可选中文字，可能是扫描版。可另存为图片后拖入，将使用 OCR 识别。`
  }
  return text
}

async function extractWord(file: File): Promise<string> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.doc') && !name.endsWith('.docx')) {
    throw new Error('暂不支持旧版 .doc，请另存为 .docx 后再拖入')
  }
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  const text = result.value.replace(/\n{3,}/g, '\n\n').trim()
  if (!text) throw new Error(`Word 文件「${file.name}」未提取到文字`)
  return text
}

async function downscaleForOcr(file: File): Promise<{ blob: Blob; dataUrl: string }> {
  const rawUrl = await fileToDataUrl(file)
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error('图片加载失败'))
    el.src = rawUrl
  })
  const maxSide = 1600
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return { blob: file, dataUrl: rawUrl }
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(img, 0, 0, w, h)
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('图片压缩失败'))),
      'image/jpeg',
      0.92,
    )
  })
  return { blob, dataUrl }
}

async function extractImageOcr(
  file: File,
  onProgress?: (message: string) => void,
): Promise<{ text: string; dataUrl: string }> {
  onProgress?.(`准备图片：${file.name}`)
  const { dataUrl } = await downscaleForOcr(file)
  // OCR 仅作纯文本模型兜底；识图模型会直接看原图。失败不阻断入库。
  try {
    onProgress?.(`本地 OCR 辅助识别：${file.name}（首次较慢，可忽略错字）`)
    const worker = await createWorker('chi_sim+eng')
    try {
      const {
        data: { text },
      } = await worker.recognize(dataUrl)
      const cleaned = text.replace(/\n{3,}/g, '\n\n').trim()
      return {
        dataUrl,
        text: cleaned
          ? `（本地 OCR 辅助，可能有错，示意图需识图模型看原图）\n${cleaned}`
          : `（图片：${file.name}）本地 OCR 未识别出文字；请用识图模型发送原图整理。`,
      }
    } finally {
      await worker.terminate()
    }
  } catch {
    return {
      dataUrl,
      text: `（图片：${file.name}）本地 OCR 跳过；请用识图模型发送原图整理。`,
    }
  }
}

export async function extractFromFile(
  file: File,
  onProgress?: (message: string) => void,
): Promise<ExtractResult> {
  if (isPlainText(file) || file.type === 'application/json') {
    onProgress?.(`读取文本：${file.name}`)
    return { kind: 'text', textContent: await file.text() }
  }

  if (isHtml(file)) {
    onProgress?.(`解析 HTML：${file.name}`)
    const html = await file.text()
    return { kind: 'html', textContent: stripHtml(html) }
  }

  if (isPdf(file)) {
    onProgress?.(`解析 PDF：${file.name}`)
    const [textContent, dataUrl] = await Promise.all([
      extractPdf(file),
      fileToDataUrl(file),
    ])
    return { kind: 'pdf', textContent, dataUrl }
  }

  if (isWord(file)) {
    onProgress?.(`解析 Word：${file.name}`)
    const [textContent, dataUrl] = await Promise.all([
      extractWord(file),
      fileToDataUrl(file),
    ])
    return { kind: 'word', textContent, dataUrl }
  }

  if (isImage(file)) {
    const { text, dataUrl } = await extractImageOcr(file, onProgress)
    return { kind: 'image', textContent: text, dataUrl }
  }

  onProgress?.(`尝试按文本读取：${file.name}`)
  try {
    return { kind: 'unknown', textContent: await file.text() }
  } catch {
    throw new Error(`暂不支持的文件类型：${file.name}`)
  }
}

/** @deprecated 兼容旧调用 */
export async function extractTextFromFile(file: File): Promise<string> {
  const result = await extractFromFile(file)
  return result.textContent
}
