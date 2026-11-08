import { useRef, useState } from 'react'
import { filesFromClipboard } from '../lib/clipboardFiles'

interface Props {
  prompt: string
  onPromptChange: (v: string) => void
  onFiles: (files: FileList | File[]) => void
  onOrganize: (opts: {
    titleMode: 'ai' | 'manual'
    manualTitle?: string
  }) => void
  organizing: boolean
  disabled?: boolean
}

export function OrganizeBar(props: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const pasteRef = useRef<HTMLTextAreaElement>(null)
  const [dragging, setDragging] = useState(false)
  const [titleMode, setTitleMode] = useState<'ai' | 'manual'>('ai')
  const [manualTitle, setManualTitle] = useState('')
  const [pasteDraft, setPasteDraft] = useState('')

  const ingestFiles = (files: File[]) => {
    if (!files.length || props.disabled) return
    props.onFiles(files)
  }

  const ingestPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (props.disabled) return
    const files = filesFromClipboard(e.clipboardData)
    if (files.length) {
      e.preventDefault()
      ingestFiles(files)
      setPasteDraft('')
      return
    }
    // 无图片时保留默认文字粘贴，可再点「加入原料」
  }

  const commitPasteText = () => {
    const text = pasteDraft.trim()
    if (!text || props.disabled) return
    const stamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, 19)
    ingestFiles([
      new File([text], `paste-${stamp}.txt`, { type: 'text/plain' }),
    ])
    setPasteDraft('')
  }

  return (
    <div className="organize-bar">
      <div
        className={`drop-zone ${dragging ? 'dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          if (e.dataTransfer.files?.length) {
            ingestFiles(Array.from(e.dataTransfer.files))
          }
        }}
      >
        <textarea
          ref={pasteRef}
          className="paste-box"
          disabled={props.disabled}
          value={pasteDraft}
          placeholder="在此 Ctrl+V 粘贴截图或文字…"
          onChange={(e) => setPasteDraft(e.target.value)}
          onPaste={ingestPaste}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              e.preventDefault()
              commitPasteText()
            }
          }}
        />
        <div className="drop-zone-actions">
          <button
            type="button"
            className="drop-link"
            disabled={props.disabled}
            onClick={() => inputRef.current?.click()}
          >
            选择文件
          </button>
          <button
            type="button"
            className="drop-link"
            disabled={props.disabled || !pasteDraft.trim()}
            onClick={commitPasteText}
          >
            加入文字原料
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          accept=".txt,.md,.html,.htm,.pdf,.doc,.docx,.png,.jpg,.jpeg,.gif,.webp,.bmp,text/*,image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(e) => {
            if (e.target.files?.length) ingestFiles(Array.from(e.target.files))
            e.target.value = ''
          }}
        />
      </div>

      <div className="organize-main">
        <div className="organize-title-opts">
          <label className={titleMode === 'ai' ? 'on' : ''}>
            <input
              type="radio"
              name="organize-title-mode"
              checked={titleMode === 'ai'}
              onChange={() => setTitleMode('ai')}
            />
            AI 总结标题
          </label>
          <label className={titleMode === 'manual' ? 'on' : ''}>
            <input
              type="radio"
              name="organize-title-mode"
              checked={titleMode === 'manual'}
              onChange={() => setTitleMode('manual')}
            />
            自己命名
          </label>
          {titleMode === 'manual' ? (
            <input
              className="organize-title-input"
              value={manualTitle}
              onChange={(e) => setManualTitle(e.target.value)}
              placeholder="输入本条知识的标题"
            />
          ) : null}
        </div>
        <div className="organize-row">
          <input
            className="prompt-input"
            placeholder="汇总提示词：整理方向、侧重点、输出风格…"
            value={props.prompt}
            onChange={(e) => props.onPromptChange(e.target.value)}
          />
          <button
            type="button"
            className="organize-btn"
            disabled={
              props.disabled ||
              props.organizing ||
              (titleMode === 'manual' && !manualTitle.trim())
            }
            onClick={() =>
              props.onOrganize({
                titleMode,
                manualTitle: manualTitle.trim(),
              })
            }
          >
            {props.organizing ? '整理中…' : '开始整理'}
          </button>
        </div>
      </div>
    </div>
  )
}
