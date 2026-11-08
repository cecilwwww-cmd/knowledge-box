import { useState } from 'react'
import type { AppSettings } from '../db/types'

interface Props {
  settings: AppSettings
  onSave: (s: AppSettings) => void
  onClose: () => void
}

const PRESETS: Array<{
  label: string
  apiBaseUrl: string
  modelName: string
  sendImages: boolean
  note: string
}> = [
  {
    label: 'OpenAI 识图',
    apiBaseUrl: 'https://api.openai.com/v1',
    modelName: 'gpt-4o-mini',
    sendImages: true,
    note: '能看图+示意图',
  },
  {
    label: '通义千问 VL',
    apiBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    modelName: 'qwen-vl-plus',
    sendImages: true,
    note: '国内常用识图',
  },
  {
    label: 'DeepSeek 文本',
    apiBaseUrl: 'https://api.deepseek.com/v1',
    modelName: 'deepseek-chat',
    sendImages: false,
    note: '不能看图，只能靠 OCR',
  },
]

export function SettingsModal({ settings, onSave, onClose }: Props) {
  const [draft, setDraft] = useState<AppSettings>({
    ...settings,
    sendImages: settings.sendImages !== false,
  })

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <header>
          <h2>本地设置</h2>
          <p>
            Key 只存在本机。要像网页对话框那样理解示意图，必须用<strong>多模态识图模型</strong>
            ，并打开「发送原图」。DeepSeek Chat 是纯文本，只能靠易错的 OCR。
          </p>
        </header>

        <div className="preset-row">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              className="preset-chip"
              title={p.note}
              onClick={() =>
                setDraft({
                  ...draft,
                  apiBaseUrl: p.apiBaseUrl,
                  modelName: p.modelName,
                  sendImages: p.sendImages,
                })
              }
            >
              {p.label}
            </button>
          ))}
        </div>

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
            placeholder="gpt-4o-mini / qwen-vl-plus"
          />
        </label>

        <label className="field checkbox-field">
          <input
            type="checkbox"
            checked={draft.sendImages !== false}
            onChange={(e) => setDraft({ ...draft, sendImages: e.target.checked })}
          />
          <span>发送原图给模型（识图 / 理解示意图，需多模态模型）</span>
        </label>

        <footer>
          <button type="button" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => {
              onSave({ ...draft, sendImages: draft.sendImages !== false })
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
