import type { SourceItem } from '../db/types'

interface Props {
  source: SourceItem
}

export function SourcePreview({ source }: Props) {
  if (source.kind === 'image' && source.dataUrl) {
    return (
      <div className="source-preview">
        <header>
          <strong>{source.name}</strong>
          <span>图片</span>
        </header>
        <div className="source-preview-body">
          <img src={source.dataUrl} alt={source.name} />
        </div>
      </div>
    )
  }

  if (source.kind === 'pdf' && source.dataUrl) {
    return (
      <div className="source-preview">
        <header>
          <strong>{source.name}</strong>
          <a href={source.dataUrl} download={source.name}>
            下载 PDF
          </a>
        </header>
        <div className="source-preview-body">
          <iframe title={source.name} src={source.dataUrl} />
        </div>
      </div>
    )
  }

  if ((source.kind === 'word' || source.kind === 'pdf') && !source.dataUrl) {
    return (
      <div className="source-preview">
        <header>
          <strong>{source.name}</strong>
          <span>{source.kind === 'word' ? 'Word 文本摘录' : 'PDF 文本摘录'}</span>
        </header>
        <div className="source-preview-body">
          <pre>{source.textContent || '（无文本）'}</pre>
        </div>
      </div>
    )
  }

  if (source.dataUrl && source.mimeType.startsWith('application/')) {
    return (
      <div className="source-preview">
        <header>
          <strong>{source.name}</strong>
          <a href={source.dataUrl} download={source.name}>
            下载文件
          </a>
        </header>
        <div className="source-preview-body">
          <pre>{source.textContent.slice(0, 8000) || '二进制文件，请下载查看。'}</pre>
        </div>
      </div>
    )
  }

  return (
    <div className="source-preview">
      <header>
        <strong>{source.name}</strong>
        <span>{source.kind || '文本'}</span>
      </header>
      <div className="source-preview-body">
        <pre>{source.textContent || '（无内容）'}</pre>
      </div>
    </div>
  )
}
