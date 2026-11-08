import { useEffect, useRef } from 'react'
import Vditor from 'vditor'
import 'vditor/dist/index.css'

interface Props {
  markdown: string
  onChange: (markdown: string) => void
}

export function DetailEditor({ markdown, onChange }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<Vditor | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!hostRef.current) return
    let cancelled = false

    const editor = new Vditor(hostRef.current, {
      height: '100%',
      mode: 'ir',
      value: markdown,
      placeholder: '直接写 Markdown，内容会即时渲染…',
      cache: { enable: false },
      toolbar: [
        'headings',
        'bold',
        'italic',
        'strike',
        '|',
        'list',
        'ordered-list',
        'check',
        '|',
        'quote',
        'code',
        'inline-code',
        'link',
        'table',
        '|',
        'undo',
        'redo',
        '|',
        'fullscreen',
      ],
      preview: {
        markdown: {
          toc: false,
        },
      },
      after: () => {
        if (cancelled) {
          editor.destroy()
          return
        }
        editorRef.current = editor
      },
      input: (value) => {
        onChangeRef.current(value)
      },
      blur: () => {
        onChangeRef.current(editor.getValue())
      },
    })

    return () => {
      cancelled = true
      editorRef.current = null
      try {
        editor.destroy()
      } catch {
        // ignore
      }
      if (hostRef.current) hostRef.current.innerHTML = ''
    }
    // remount via key when switching nodes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    try {
      if (editor.getValue() !== markdown) {
        editor.setValue(markdown, true)
      }
    } catch {
      // editor may not be ready
    }
  }, [markdown])

  return (
    <div className="detail-editor">
      <div className="vditor-host" ref={hostRef} />
    </div>
  )
}
