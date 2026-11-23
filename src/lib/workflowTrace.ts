export type WorkflowStep = {
  id: string
  label: string
  state: 'running' | 'done' | 'failed' | 'waiting' | 'skipped'
  detail?: string
}

export type WorkflowReporter = (step: WorkflowStep) => void

export async function runWorkflowStep<T>(
  report: WorkflowReporter | undefined,
  id: string,
  label: string,
  work: () => T | Promise<T>,
  describe?: (result: T) => string,
): Promise<T> {
  report?.({ id, label, state: 'running' })
  try {
    const result = await work()
    report?.({ id, label, state: 'done', detail: describe?.(result) })
    return result
  } catch (error) {
    report?.({ id, label, state: 'failed' })
    throw error
  }
}
