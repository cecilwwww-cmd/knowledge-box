export async function extractTextFromFile(file: File): Promise<string> {
  const type = file.type || ''
  const name = file.name.toLowerCase()

  if (
    type.startsWith('text/') ||
    name.endsWith('.md') ||
    name.endsWith('.txt') ||
    name.endsWith('.csv') ||
    name.endsWith('.json') ||
    name.endsWith('.ts') ||
    name.endsWith('.tsx') ||
    name.endsWith('.js') ||
    name.endsWith('.py')
  ) {
    return file.text()
  }

  if (type === 'application/json') {
    return file.text()
  }

  if (name.endsWith('.html') || name.endsWith('.htm') || type === 'text/html') {
    const html = await file.text()
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  // PDF / images: keep a stub note; OCR can be added later
  if (type.startsWith('image/') || name.endsWith('.pdf')) {
    return `[附件: ${file.name}]（一期暂不解析图片/PDF 正文，请另附文本或在提示词中说明要点）`
  }

  try {
    return await file.text()
  } catch {
    return `[无法读取的文件: ${file.name}]`
  }
}
