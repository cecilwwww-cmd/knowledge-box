const repoApi = 'https://api.github.com/repos/cecilwwww-cmd/knowledge-box'
const number = new Intl.NumberFormat('zh-CN')
const updated = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit',
})
const byId = (id) => document.getElementById(id)

function element(tag, value, className) {
  const node = document.createElement(tag)
  node.textContent = value
  if (className) node.className = className
  return node
}

function status(id, message, error = false) {
  const node = byId(id)
  node.textContent = message
  node.dataset.error = error
}

function table(headers, rows, caption) {
  const table = element('table', '')
  table.setAttribute('aria-label', caption)
  const head = table.createTHead().insertRow()
  headers.forEach((name) => {
    const cell = element('th', name)
    cell.scope = 'col'
    head.append(cell)
  })
  const body = table.createTBody()
  for (const row of rows) {
    const item = body.insertRow()
    for (const value of row) item.insertCell().append(value)
  }
  return table
}

async function releases() {
  const versions = []
  for (let page = 1; ; page++) {
    const response = await fetch(`${repoApi}/releases?per_page=100&page=${page}`, {
      signal: AbortSignal.timeout(12000),
    })
    if (!response.ok) throw new Error(`GitHub HTTP ${response.status}`)
    const data = await response.json()
    for (const release of data) {
      const installers = release.assets.filter((asset) =>
        asset.state === 'uploaded' && /^KnowledgeBox-Setup-.*\.exe$/i.test(asset.name))
      if (installers.length && !release.draft) {
        versions.push({
          tag: release.tag_name,
          date: release.published_at?.slice(0, 10) || '—',
          preview: release.prerelease,
          downloads: installers.reduce((sum, asset) => sum + asset.download_count, 0),
        })
      }
    }
    if (data.length < 100) break
  }
  return versions
}

async function renderDownloads() {
  try {
    const versions = await releases()
    const latest = versions.find((version) => !version.preview)
    byId('downloads-total').textContent = number.format(versions.reduce((sum, version) => sum + version.downloads, 0))
    byId('downloads-latest').textContent = latest ? number.format(latest.downloads) : '—'
    byId('version').textContent = latest?.tag || ''
    byId('release-count').textContent = number.format(versions.length)
    const rows = versions.map((version) => {
      const link = element('a', version.tag + (version.preview ? '（预览版）' : ''))
      link.href = `https://github.com/cecilwwww-cmd/knowledge-box/releases/tag/${encodeURIComponent(version.tag)}`
      return [link, version.date, number.format(version.downloads)]
    })
    byId('downloads').replaceChildren(table(['版本', '发布日期', '下载次数'], rows, '各版本下载次数'))
    byId('downloads').hidden = !rows.length
    status('download-status', rows.length
      ? `上次读取 ${updated.format(new Date())}（北京时间）`
      : '尚未发布 Windows 安装包。')
  } catch (error) {
    status('download-status', `读取 GitHub 失败，请稍后刷新。${error.message.startsWith('GitHub HTTP') ? `（${error.message}）` : ''}`, true)
  }
}

async function refresh() {
  const button = byId('refresh')
  button.disabled = true
  try {
    await renderDownloads()
  } finally {
    button.disabled = false
  }
}

byId('refresh').addEventListener('click', refresh)
void refresh()
