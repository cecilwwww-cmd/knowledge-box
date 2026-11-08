import { useState } from 'react'
import type { AppSettings } from '../db/types'

interface Props {
  settings: AppSettings
  onSave: (s: AppSettings) => void
  onClose: () => void
}

export function SettingsModal({ settings, onSave, onClose }: Props) {
  const [draft, setDraft] = useState(settings)

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <header>
          <h2>本地设置</h2>
          <p>
            Key 只存在本机浏览器。图片会先本地 OCR 再发给模型；DeepSeek 填
            <code> https://api.deepseek.com/v1 </code>+
            <code> deepseek-chat </code>
            即可。
          </p>
        </header>

        <label className="field">
          <span>API Base URL</span>
          <input
            value={draft.apiBaseUrl}
            onChange={(e) => setDraft({ ...draft, apiBaseUrl: e.target.value })}
            placeholder="https://api.openai.com/v1"
          />
        </label>
        <label className="field">
          <span>API Key</span>
          <input
            type="password"
            value={draft.apiKey}
            onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
            placeholder="sk-..."
          />
        </label>
        <label className="field">
          <span>模型名</span>
          <input
            value={draft.modelName}
            onChange={(e) => setDraft({ ...draft, modelName: e.target.value })}
            placeholder="gpt-4o-mini"
          />
        </label>

        <footer>
          <button type="button" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => {
              onSave(draft)
              onClose()
            }}
          >
            保存
          </button>
        </footer>
      </div>
    </div>
  )
}
