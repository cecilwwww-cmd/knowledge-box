import { useRef, useState } from 'react'

type TabKey = 'sources' | 'mindmap' | 'detail'

interface Props {
  prompt: string
  onPromptChange: (v: string) => void
  onFiles: (files: FileList | File[]) => void
  onOrganize: () => void
  organizing: boolean
  disabled?: boolean
  activeTab: TabKey
  onTabChange: (tab: TabKey) => void
}

const TABS: Array<[TabKey, string]> = [
  ['sources', '原料'],
  ['mindmap', '思维导图'],
  ['detail', '详细内容'],
]

export function OrganizeBar(props: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  return (
    <div className="organize-bar">
      <div className="tabs organize-tabs" role="tablist">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={props.activeTab === key}
            className={props.activeTab === key ? 'active' : ''}
            onClick={() => props.onTabChange(key)}
          >
            {label}
          </button>
        ))}
      </div>

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

      <input
        className="prompt-input"
        placeholder="汇总提示词：整理方向、侧重点、输出风格…"
        value={props.prompt}
        onChange={(e) => props.onPromptChange(e.target.value)}
      />

      <button
        type="button"
        className="organize-btn"
        disabled={props.disabled || props.organizing}
        onClick={props.onOrganize}
      >
        {props.organizing ? '整理中…' : '开始整理'}
      </button>
    </div>
  )
}

export { TABS }
export type { TabKey }
