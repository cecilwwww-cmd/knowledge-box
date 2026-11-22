import mammoth from 'mammoth'
import { useEffect, useState } from 'react'
import { embeddedImage } from '../lib/sourceFile'

const wordElements = new Set([
  'P', 'DIV', 'SPAN', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI',
  'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD', 'IMG',
  'STRONG', 'EM', 'B', 'I', 'U', 'S', 'SUP', 'SUB', 'BR', 'HR',
])

function readableHtml(html: string) {
  const input = document.createElement('template')
  const output = document.createElement('div')
  input.innerHTML = html

  function append(source: Node, destination: HTMLElement) {
    if (source.nodeType === Node.TEXT_NODE) {
      destination.append(document.createTextNode(source.textContent || ''))
    }
    if (!(source instanceof Element)) return
    if (source.tagName === 'IMG') {
      const url = source.getAttribute('src') || ''
      if (!embeddedImage.test(url)) return
      const image = document.createElement('img')
      image.src = url
      image.alt = source.getAttribute('alt') || '文档图片'
      image.loading = 'lazy'
      destination.append(image)
      return
    }
    if (wordElements.has(source.tagName)) {
      const element = document.createElement(source.tagName.toLowerCase())
      if (element instanceof HTMLTableCellElement) {
        for (const attr of ['colspan', 'rowspan']) {
          const value = source.getAttribute(attr)
          if (value && /^[1-9]\d{0,2}$/.test(value)) element.setAttribute(attr, value)
        }
      }
      destination.append(element)
      destination = element
    }
    source.childNodes.forEach((child) => append(child, destination))
  }

  input.content.childNodes.forEach((child) => append(child, output))
  return output.innerHTML
}

export function WordReader({ url, text }: { url: string; text: string }) {
  const [result, setResult] = useState<{ html?: string; error?: string }>()
  useEffect(() => {
    const controller = new AbortController()
    void fetch(url, { signal: controller.signal })
      .then((response) => response.arrayBuffer())
      .then((arrayBuffer) => mammoth.convertToHtml({ arrayBuffer }))
      .then(({ value }) => {
        if (!controller.signal.aborted) setResult({ html: readableHtml(value) })
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setResult({ error: '无法在应用内读取此 Word 文档，可下载原文件查看。' })
        }
      })
    return () => controller.abort()
  }, [url])

  if (!result) return <p className="source-reader-status" role="status">正在打开 Word 文档…</p>
  if (result.error) return (
    <>
      <p className="source-reader-status" role="status">{result.error}</p>
      {text && <pre>{text}</pre>}
    </>
  )
  if (!result.html) return <p className="source-reader-status">此文档没有可显示的内容。</p>
  return <div className="source-word-page" dangerouslySetInnerHTML={{ __html: result.html }} />
}
