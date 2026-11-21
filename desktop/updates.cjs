const { app, dialog } = require('electron')
const { autoUpdater } = require('electron-updater')

autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = false

let checking = false

async function checkForUpdates(win) {
  if (!app.isPackaged || !win || checking) return
  checking = true
  const show = (options) => win.isDestroyed()
    ? Promise.resolve({ response: 1 })
    : dialog.showMessageBox(win, { title: '知识箱更新', ...options })
  const progress = ({ percent }) => {
    if (!win.isDestroyed()) win.setProgressBar(percent / 100)
  }

  try {
    const release = await autoUpdater.checkForUpdates()
    if (!release?.isUpdateAvailable) {
      await show({ type: 'info', message: `当前已是最新版（${app.getVersion()}）。` })
      return
    }
    const version = release.updateInfo.version
    const download = await show({
      type: 'info',
      message: `发现新版本 ${version}`,
      buttons: ['下载更新', '稍后'],
      cancelId: 1,
    })
    if (download.response !== 0) return

    autoUpdater.on('download-progress', progress)
    try {
      if (!win.isDestroyed()) win.setProgressBar(2)
      await autoUpdater.downloadUpdate()
    } finally {
      autoUpdater.removeListener('download-progress', progress)
      if (!win.isDestroyed()) win.setProgressBar(-1)
    }
    const install = await show({
      type: 'info',
      message: `版本 ${version} 已下载，可以重启安装。`,
      buttons: ['重启并安装', '稍后'],
      cancelId: 1,
    })
    if (install.response === 0) autoUpdater.quitAndInstall(false, true)
  } catch (error) {
    console.error(error)
    await show({
      type: 'warning',
      message: error.code === 'ERR_UPDATER_NO_PUBLISHED_VERSIONS'
        ? '更新渠道暂无已发布的桌面版本。'
        : '暂时无法检查或下载更新，请稍后重试。',
    })
  } finally {
    checking = false
  }
}

module.exports = { checkForUpdates }
