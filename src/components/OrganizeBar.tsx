import { useRef, useState } from 'react'

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
  const [dragging, setDragging] = useState(false)
  const [titleMode, setTitleMode] = useState<'ai' | 'manual'>('ai')
  const [manualTitle, setManualTitle] = useState('')

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
          if (e.dataTransfer.files?.length) props.onFiles(e.dataTransfer.files)
        }}
        onClick={() => inputRef.current?.click()}
      >
        <span>拖入图文/PDF/Word/HTML</span>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          accept=".txt,.md,.html,.htm,.pdf,.doc,.docx,.png,.jpg,.jpeg,.gif,.webp,.bmp,text/*,image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(e) => {
            if (e.target.files?.length) props.onFiles(e.target.files)
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
