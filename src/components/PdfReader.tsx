import { PasswordResponses, type PDFDocumentProxy, type RenderTask } from 'pdfjs-dist'
import { useEffect, useRef, useState } from 'react'
import { openPdf } from '../lib/pdf'

export function PdfReader({ url }: { url: string }) {
  const [pdf, setPdf] = useState<PDFDocumentProxy>()
  const [page, setPage] = useState(1)
  const [zoom, setZoom] = useState(1)
  const [width, setWidth] = useState(0)
  const [error, setError] = useState('')
  const [pageError, setPageError] = useState(false)
  const [password, setPassword] = useState<{ retry: boolean; submit: (value: string) => void }>()
  const scroller = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    let loading: ReturnType<typeof openPdf> | undefined
    void fetch(url, { signal: controller.signal })
      .then((response) => response.arrayBuffer())
      .then((bytes) => {
        if (controller.signal.aborted) return
        loading = openPdf(new Uint8Array(bytes))
        loading.onPassword = (submit: (value: string) => void, reason: number) => {
          setPassword({ submit, retry: reason === PasswordResponses.INCORRECT_PASSWORD })
        }
        return loading.promise
      })
      .then((document) => {
        if (!document || controller.signal.aborted) return
        setPassword(undefined)
        setPdf(document)
      })
      .catch(() => {
        if (!controller.signal.aborted) setError('无法打开此 PDF，可下载原文件查看。')
      })
    return () => {
      controller.abort()
      void loading?.destroy().catch(() => {})
    }
  }, [url])

  useEffect(() => {
    const element = scroller.current
    if (!element) return
    const observer = new ResizeObserver(() => setWidth(element.clientWidth))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    scroller.current?.scrollTo(0, 0)
  }, [page])

  useEffect(() => {
    const target = canvas.current
    if (!pdf || !target || width <= 24) return
    let cancelled = false
    let task: RenderTask | undefined
    setPageError(false)
    void pdf.getPage(page).then((pdfPage) => {
      if (cancelled) return
      const natural = pdfPage.getViewport({ scale: 1 })
      const scale = Math.min((width - 24) / natural.width, 1.6) * zoom
      const viewport = pdfPage.getViewport({ scale })
      const ratio = Math.min(window.devicePixelRatio || 1, 2,
        4096 / viewport.width, 4096 / viewport.height)
      target.width = Math.ceil(viewport.width * ratio)
      target.height = Math.ceil(viewport.height * ratio)
      target.style.width = `${viewport.width}px`
      target.style.height = `${viewport.height}px`
      task = pdfPage.render({ canvas: target, viewport, transform: [ratio, 0, 0, ratio, 0, 0] })
      return task.promise
    }).catch(() => {
      if (!cancelled) setPageError(true)
    })
    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [pdf, page, width, zoom])

  return (
    <div className="source-pdf-reader">
      {pdf && (
        <div className="source-reader-tools" aria-label="PDF 阅读工具">
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</button>
          <form key={page} onSubmit={(event) => {
            event.preventDefault()
            const number = Number(new FormData(event.currentTarget).get('page'))
            if (!Number.isInteger(number) || number < 1 || number > pdf.numPages) return
            setPage(number)
          }}>
            <input name="page" aria-label="跳到页码" type="number" min={1} max={pdf.numPages} defaultValue={page} />
            <span> / {pdf.numPages} 页</span>
          </form>
          <button type="button" disabled={page >= pdf.numPages} onClick={() => setPage(page + 1)}>下一页</button>
          <button type="button" aria-label="缩小" disabled={zoom <= 0.5}
            onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}>−</button>
          <button type="button" title="适应宽度" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
          <button type="button" aria-label="放大" disabled={zoom >= 3}
            onClick={() => setZoom(Math.min(3, zoom + 0.25))}>+</button>
        </div>
      )}
      <div className="source-pdf-scroll" ref={scroller}>
        {error ? <p className="source-reader-status" role="status">{error}</p> : pdf ? (
          <>
            {pageError && <p className="source-reader-status" role="status">当前页渲染失败，可下载原文件查看。</p>}
            <canvas hidden={pageError} ref={canvas} aria-label={`PDF 第 ${page} 页`} />
          </>
        ) : password ? (
          <form className="source-reader-password" onSubmit={(event) => {
            event.preventDefault()
            const value = String(new FormData(event.currentTarget).get('password') || '')
            password.submit(value)
            setPassword(undefined)
          }}>
            <label>
              {password.retry ? '密码不正确，请重试' : '此 PDF 需要密码'}
              <input name="password" type="password" required autoComplete="off" />
            </label>
            <button type="submit">打开</button>
          </form>
        ) : <p className="source-reader-status" role="status">正在打开 PDF…</p>}
      </div>
    </div>
  )
}
