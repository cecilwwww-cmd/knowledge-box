import { useRef, useState } from 'react'

interface Props {
  prompt: string
  onPromptChange: (v: string) => void
  onFiles: (files: FileList | File[]) => void
  onOrganize: () => void
  organizing: boolean
  disabled?: boolean
}

export function OrganizeBar(props: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

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
        <span>拖入图文 / 点击选择</span>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
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
