import { useState } from 'react'
import { appConfig } from '../config'
import type { AppSettings } from '../db/types'
import {
  DETAIL_TEMPLATES,
  resolveDetailTemplate,
} from '../lib/detailTemplates'

interface Props {
  settings: AppSettings
  onSave: (s: AppSettings) => void
  onClose: () => void
}

type SettingsSection =
  | 'appearance'
  | 'api'
  | 'account'
  | 'security'

const SECTIONS: Array<{
  id: SettingsSection
  label: string
  desc: string
  ready: boolean
}> = [
  {
    id: 'appearance',
    label: '外观与排版',
    desc: '详情模板、阅读样式',
    ready: true,
  },
  {
    id: 'api',
    label: '模型与 API',
    desc: 'DeepSeek 等模型配置',
    ready: true,
  },
  {
    id: 'account',
    label: '用户中心',
    desc: '账号与个人资料',
    ready: false,
  },
  {
    id: 'security',
    label: '安全中心',
    desc: '密码与隐私保护',
    ready: false,
  },
]

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
  const [section, setSection] = useState<SettingsSection>('appearance')
  const [draft, setDraft] = useState<AppSettings>({
    ...settings,
    sendImages: settings.sendImages !== false,
  })

  const current = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0]

  const save = () => {
    onSave({
      ...draft,
      sendImages: draft.sendImages !== false,
      detailTemplate: resolveDetailTemplate(draft.detailTemplate),
    })
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal settings-modal"
        role="dialog"
        aria-labelledby="settings-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="settings-modal-head">
          <div>
            <h2 id="settings-title">设置</h2>
            <p>按分类管理；后续用户中心、安全中心会陆续补齐。</p>
          </div>
          <button type="button" className="settings-close" onClick={onClose}>
            关闭
          </button>
        </header>

        <div className="settings-layout">
          <nav className="settings-nav" aria-label="设置分类">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`settings-nav-item ${section === s.id ? 'active' : ''} ${
                  s.ready ? '' : 'soon'
                }`}
                onClick={() => setSection(s.id)}
              >
                <span className="settings-nav-label">{s.label}</span>
                <span className="settings-nav-desc">
                  {s.ready ? s.desc : `${s.desc} · 稍后`}
                </span>
              </button>
            ))}
          </nav>

          <div className="settings-panel">
            <div className="settings-panel-title">
              <h3>{current.label}</h3>
              <p>{current.desc}</p>
            </div>

            {section === 'appearance' ? (
              <div className="settings-block">
                <div className="field">
                  <span>详细内容排版</span>
                  <p className="field-note">
                    AI 整理 / 归类会按所选风格写 Markdown，详情页用对应样式渲染。
                  </p>
                  <div className="preset-row" role="radiogroup" aria-label="排版模板">
                    {DETAIL_TEMPLATES.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        role="radio"
                        aria-checked={
                          resolveDetailTemplate(draft.detailTemplate) === t.id
                        }
                        className={`preset-chip ${
                          resolveDetailTemplate(draft.detailTemplate) === t.id
                            ? 'active'
                            : ''
                        }`}
                        title={t.hint}
                        disabled={!t.ready}
                        onClick={() =>
                          setDraft({
                            ...draft,
                            detailTemplate: t.id,
                          })
                        }
                      >
                        {t.label}
                        {!t.ready ? '·稍后' : ''}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {section === 'api' ? (
              <div className="settings-block">
                <p className="field-note">
                  {locked
                    ? 'API 已由管理员统一配置为 DeepSeek 识图（deepseek-flash），终端用户无需自备 Key。'
                    : '识图请用 deepseek-flash，并打开「发送原图」。deepseek-chat 是纯文本，看不懂示意图。'}
                </p>

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
                    onChange={(e) =>
                      setDraft({ ...draft, apiBaseUrl: e.target.value })
                    }
                    placeholder="https://api.deepseek.com/v1"
                  />
                </label>
                <label className="field">
                  <span>API Key</span>
                  <input
                    type="password"
                    value={draft.apiKey}
                    disabled={locked}
                    onChange={(e) =>
                      setDraft({ ...draft, apiKey: e.target.value })
                    }
                    placeholder={locked ? '已由管理员配置' : 'sk-...'}
                  />
                </label>
                <label className="field">
                  <span>模型名</span>
                  <input
                    value={draft.modelName}
                    disabled={locked}
                    onChange={(e) =>
                      setDraft({ ...draft, modelName: e.target.value })
                    }
                    placeholder="deepseek-flash"
                  />
                </label>

                <label className="field checkbox-field">
                  <input
                    type="checkbox"
                    checked={draft.sendImages !== false}
                    disabled={locked}
                    onChange={(e) =>
                      setDraft({ ...draft, sendImages: e.target.checked })
                    }
                  />
                  <span>发送原图给模型（deepseek-flash 识图 / 理解示意图）</span>
                </label>
              </div>
            ) : null}

            {section === 'account' ? (
              <div className="settings-placeholder">
                <strong>用户中心即将上线</strong>
                <p>计划支持登录账号、同步偏好、个人资料等。</p>
              </div>
            ) : null}

            {section === 'security' ? (
              <div className="settings-placeholder">
                <strong>安全中心即将上线</strong>
                <p>计划支持本地加密、访问口令、隐私清理等。</p>
              </div>
            ) : null}
          </div>
        </div>

        <footer className="settings-modal-foot">
          <button type="button" onClick={onClose}>
            取消
          </button>
          <button type="button" className="primary" onClick={save}>
            保存
          </button>
        </footer>
      </div>
    </div>
  )
}
