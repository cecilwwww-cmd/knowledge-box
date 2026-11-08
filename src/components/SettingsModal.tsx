import { useState } from 'react'
import { appConfig } from '../config'
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
    label: 'DeepSeek 识图',
    apiBaseUrl: 'https://api.deepseek.com/v1',
    modelName: 'deepseek-flash',
    sendImages: true,
    note: '官方多模态，能看示意图',
  },
  {
    label: 'DeepSeek 文本',
    apiBaseUrl: 'https://api.deepseek.com/v1',
    modelName: 'deepseek-chat',
    sendImages: false,
    note: '纯文本，不能看图',
  },
]

export function SettingsModal({ settings, onSave, onClose }: Props) {
  const locked = appConfig.lockApiSettings
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
            {locked
              ? 'API 已由管理员统一配置为 DeepSeek 识图（deepseek-flash），终端用户无需自备 Key。'
              : '识图请用 deepseek-flash，并打开「发送原图」。deepseek-chat 是纯文本，看不懂示意图。'}
          </p>
        </header>

        {!locked ? (
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
        ) : null}

        <label className="field">
          <span>API Base URL</span>
          <input
            value={draft.apiBaseUrl}
            disabled={locked}
            onChange={(e) => setDraft({ ...draft, apiBaseUrl: e.target.value })}
            placeholder="https://api.deepseek.com/v1"
          />
        </label>
        <label className="field">
          <span>API Key</span>
          <input
            type="password"
            value={draft.apiKey}
            disabled={locked}
            onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
            placeholder={locked ? '已由管理员配置' : 'sk-...'}
          />
        </label>
        <label className="field">
          <span>模型名</span>
          <input
            value={draft.modelName}
            disabled={locked}
            onChange={(e) => setDraft({ ...draft, modelName: e.target.value })}
            placeholder="deepseek-flash"
          />
        </label>

        <label className="field checkbox-field">
          <input
            type="checkbox"
            checked={draft.sendImages !== false}
            disabled={locked}
            onChange={(e) => setDraft({ ...draft, sendImages: e.target.checked })}
          />
          <span>发送原图给模型（deepseek-flash 识图 / 理解示意图）</span>
        </label>

        <footer>
          <button type="button" onClick={onClose}>
            {locked ? '关闭' : '取消'}
          </button>
          {!locked ? (
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
          ) : null}
        </footer>
      </div>
    </div>
  )
}
