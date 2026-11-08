/** 从剪贴板取出可入库的 File 列表（图片优先，其次纯文本） */
export async function filesFromClipboard(
  clipboardData: DataTransfer | null,
): Promise<File[]> {
  if (!clipboardData) return []

  const out: File[] = []
  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .slice(0, 19)

  // 1) 系统截图 / 复制的图片文件
  if (clipboardData.files?.length) {
    for (const f of Array.from(clipboardData.files)) {
      if (f.type.startsWith('image/') || f.type.startsWith('text/') || f.size > 0) {
        out.push(f)
      }
    }
  }

  // 2) items 里的 image/*（部分浏览器只走这条）
  if (!out.length && clipboardData.items) {
    for (const item of Array.from(clipboardData.items)) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const blob = item.getAsFile()
        if (!blob) continue
        const ext = blob.type.split('/')[1] || 'png'
        out.push(
          new File([blob], `paste-${stamp}.${ext}`, {
            type: blob.type || 'image/png',
          }),
        )
      }
    }
  }

  // 3) 纯文本 → 记成 .txt 原料
  if (!out.length) {
    const text = clipboardData.getData('text/plain')?.trim()
    if (text) {
      out.push(
        new File([text], `paste-${stamp}.txt`, {
          type: 'text/plain',
        }),
      )
    }
  }

  return out
}

export function isEditablePasteTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  // Vditor / 富文本
  if (target.closest('.vditor, .vditor-content, [contenteditable="true"]')) {
    return true
  }
  return false
}
