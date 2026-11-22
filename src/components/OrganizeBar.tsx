import { useRef, useState } from 'react'
import { filesFromClipboard } from '../lib/clipboardFiles'
import { UiIcon } from './UiIcon'

interface Props {
  prompt: string
  onPromptChange: (value: string) => void
  onFiles: (files: File[]) => void
  onOrganize: (options: { titleMode: 'ai' | 'manual'; manualTitle?: string }) => void
  organizing: boolean
  disabled?: boolean
}

export function OrganizeBar({ prompt, onPromptChange, onFiles, onOrganize, organizing, disabled }: Props) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [manual, setManual] = useState(false)
  const [title, setTitle] = useState('')
  const unavailable = disabled || organizing

  function ingest(files: File[]) {
    if (!unavailable && files.length) onFiles(files)
  }

  return (
    <div className="organize-bar">
      <form className={`drop-zone ${dragging ? 'dragging' : ''} ${manual ? 'has-title' : ''}`}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault()
        }}
        onSubmit={(event) => {
          event.preventDefault()
          if (!unavailable && (!manual || title.trim())) {
            onOrganize({ titleMode: manual ? 'manual' : 'ai', manualTitle: title.trim() })
          }
        }}
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes('Files')) return
          event.preventDefault()
          event.dataTransfer.dropEffect = unavailable ? 'none' : 'copy'
          if (!unavailable) setDragging(true)
        }}
        onDragLeave={(event) => {
          if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) {
            setDragging(false)
          }
        }}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          ingest(Array.from(event.dataTransfer.files))
        }}>
        {manual && (
          <div className="organize-title-row">
            <label className="organize-title-field">
              <UiIcon name="pencil" />
              <input autoFocus className="organize-title-input" value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="输入自定义标题…" aria-label="自定义标题" />
            </label>
          </div>
        )}
        <div className="organize-row">
          <button type="button" className="organize-add" title="选择或拖入原料"
            aria-label="选择原料文件" disabled={unavailable} onClick={() => fileInput.current?.click()}>
            <UiIcon name="plus" />
          </button>
          <input ref={fileInput} type="file" multiple hidden
            accept=".txt,.md,.html,.htm,.pdf,.doc,.docx,.png,.jpg,.jpeg,.gif,.webp,.bmp,text/*,image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(event) => {
              ingest(Array.from(event.currentTarget.files ?? []))
              event.currentTarget.value = ''
            }} />
          <input className="prompt-input" aria-label="汇总提示词"
            placeholder="输入汇总提示词，或直接 Ctrl+V 粘贴截图 / 文字原料…"
            value={prompt} disabled={unavailable} onChange={(event) => onPromptChange(event.target.value)}
            onPaste={(event) => {
              const files = filesFromClipboard(event.clipboardData)
              if (!files.length) return
              event.preventDefault()
              ingest(files)
            }} />
          <button type="button" className="organize-title-mode" aria-pressed={manual} disabled={unavailable}
            title={manual ? '切换为 AI 命名' : '切换为自定义标题'} onClick={() => setManual(!manual)}>
            <UiIcon name="sparkle" />{manual ? '自定义标题' : 'AI 命名'}
          </button>
          <button type="submit" className="organize-btn" title={organizing ? '整理中…' : '开始整理'}
            disabled={unavailable || (manual && !title.trim())} aria-label={organizing ? '整理中' : '开始整理'}>
            <UiIcon name="arrow" />
          </button>
        </div>
      </form>
    </div>
  )
}
