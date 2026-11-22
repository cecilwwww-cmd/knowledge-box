import { lazy, Suspense } from 'react'
import type { SourceItem } from '../db/types'
import { sourceFile, sourceKind } from '../lib/sourceFile'

const WordReader = lazy(() => import('./WordReader').then((mod) => ({ default: mod.WordReader })))
const PdfReader = lazy(() => import('./PdfReader').then((mod) => ({ default: mod.PdfReader })))

export function SourcePreview({ source, onRemove }: { source: SourceItem; onRemove?: () => void }) {
  const kind = sourceKind(source)
  const file = sourceFile(source)
  const legacyWord = kind === 'word' && /\.doc$/i.test(source.name)
  const document = kind === 'pdf' || kind === 'word'
  const loading = <p className="source-reader-status" role="status">正在打开文档…</p>

  return (
    <div className="source-preview">
      <header>
        <strong>{source.name}</strong>
        <div className="source-preview-actions">
          {file && <a href={file} download={source.name}>下载原文件</a>}
          {onRemove && <button type="button" onClick={onRemove}>移除</button>}
        </div>
      </header>
      <div className={kind === 'pdf' && file ? 'source-preview-body is-pdf' : 'source-preview-body'}>
        <Suspense fallback={loading}>
          {kind === 'pdf' && file ? <PdfReader key={source.id} url={file} /> :
            kind === 'word' && file && !legacyWord ? <WordReader key={source.id} url={file} text={source.textContent} /> :
            kind === 'image' && file?.startsWith('data:image/') ? (
              <>
                <img src={file} alt={source.name} />
                {source.textContent && <details className="ocr-details">
                  <summary>本地 OCR 文本</summary>
                  <pre>{source.textContent}</pre>
                </details>}
              </>
            ) :
            <>
              {legacyWord && <p className="source-reader-status">旧版 .doc 可下载查看，另存为 .docx 后可在应用内阅读。</p>}
              {document && !file && <p className="source-reader-status">这条记录仅保存了文字摘录。重新导入原文件即可内嵌阅读。</p>}
              {source.textContent ? <pre>{source.textContent}</pre> :
                !document && <p className="source-reader-status">此文件没有可预览的文本。</p>}
            </>}
        </Suspense>
      </div>
    </div>
  )
}
