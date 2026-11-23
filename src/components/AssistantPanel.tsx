import type { ComponentProps } from 'react'
import { OrganizeBar } from './OrganizeBar'
import type { WorkflowStep } from '../lib/workflowTrace'
import type { AgentPreview, AgentScope } from '../lib/agentChanges'

const states = {
  running: '进行中',
  done: '已完成',
  failed: '失败',
  waiting: '待确认',
  skipped: '已取消',
}

export function AssistantPanel({
  command, steps, canReview, onReview, collapsed, scope, onScopeChange, note, plan, onApply, onDiscard,
  undoable, onUndo, busy, ...composer
}: ComponentProps<typeof OrganizeBar> & {
  command: string
  steps: WorkflowStep[]
  canReview: boolean
  onReview: () => void
  collapsed: boolean
  scope: AgentScope
  onScopeChange: (scope: AgentScope) => void
  note: string
  plan: AgentPreview | null
  onApply: () => void
  onDiscard: () => void
  undoable: boolean
  onUndo: () => void
  busy: boolean
}) {
  return (
    <aside className="assistant-panel" id="knowledge-assistant" aria-label="知识箱助手" hidden={collapsed}>
      <div className="assistant-workflow" aria-label="工作流">
        <div className="assistant-tools">
          <select aria-label="操作范围" value={scope} disabled={busy || !!plan} onChange={(event) =>
            onScopeChange(event.currentTarget.value === 'library' ? 'library' : 'current')}>
            <option value="current">当前笔记和子目录</option>
            <option value="library">整个知识库</option>
          </select>
          {undoable && <button type="button" disabled={busy || !!plan} onClick={onUndo}>撤销上次操作</button>}
        </div>
        {command && <p className="assistant-command">{command}</p>}
        {steps.length > 0 && (
          <ol className="assistant-steps" aria-live="polite">
            {steps.map((step) => (
              <li key={step.id} data-state={step.state}>
                <div><strong>{step.label}</strong><span>{states[step.state]}</span></div>
                {step.detail && <small>{step.detail}</small>}
              </li>
            ))}
          </ol>
        )}
        {canReview && <button className="assistant-review" type="button" onClick={onReview}>查看并确认方案</button>}
        {note && <p className="assistant-answer" role="status">{note}</p>}
        {plan && (
          <section className="assistant-plan" aria-label="修改预览">
            <ol>
              {plan.items.map((item, index) => (
                <li key={index}>
                  {item.before !== undefined || item.after !== undefined ? (
                    <details open={item.after !== undefined && item.after.length < 160}>
                      <summary>{item.label}</summary>
                      {item.before !== undefined && <pre aria-label="修改前">{item.before || '（空）'}</pre>}
                      {item.after !== undefined && <pre aria-label="修改后">{item.after || '（空）'}</pre>}
                    </details>
                  ) : <strong>{item.label}</strong>}
                  {item.detail && <small>{item.detail}</small>}
                </li>
              ))}
            </ol>
            <div className="assistant-tools">
              <button type="button" disabled={busy} onClick={onDiscard}>放弃方案</button>
              <button className="assistant-review" type="button" disabled={busy} onClick={onApply}>确认应用全部改动</button>
            </div>
          </section>
        )}
      </div>
      <OrganizeBar {...composer} agent promptPlaceholder="输入指令，如「按主题归类并更新导图」" />
    </aside>
  )
}
