const { mkdirSync } = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const {
  app, BrowserWindow, dialog, Menu, net, protocol, session, shell,
} = require('electron')
const { checkForUpdates } = require('./updates.cjs')

const appUrl = 'kb://local/index.html'
const profile = app.commandLine.getSwitchValue('user-data-dir')
const dataDir = profile ? path.resolve(profile) : path.join(app.getPath('appData'), 'KnowledgeBox')
mkdirSync(dataDir, { recursive: true })
app.setPath('userData', dataDir)

protocol.registerSchemesAsPrivileged([
  { scheme: 'kb', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
])

function serveApp() {
  const webRoot = path.join(app.getAppPath(), 'dist')
  const vendorRoot = app.isPackaged
    ? path.join(process.resourcesPath, 'vditor')
    : path.join(app.getAppPath(), 'node_modules', 'vditor')

  protocol.handle('kb', async (request) => {
    const url = new URL(request.url)
    if (request.method !== 'GET' || url.host !== 'local') {
      return new Response(null, { status: 404 })
    }

    try {
      const pathname = decodeURIComponent(url.pathname)
      const prefix = '/vendor/vditor/dist/'
      const vendorAsset = pathname.startsWith(prefix)
      const root = vendorAsset ? path.join(vendorRoot, 'dist') : webRoot
      const name = vendorAsset ? pathname.slice(prefix.length) : pathname.slice(1) || 'index.html'
      const file = path.resolve(root, name)
      const relative = path.relative(root, file)
      if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
        return new Response(null, { status: 404 })
      }
      return await net.fetch(pathToFileURL(file).toString())
    } catch {
      return new Response(null, { status: 404 })
    }
  })
}

let mainWindow

function openExternal(url) {
  if (url.startsWith('https://') || url.startsWith('http://')) {
    void shell.openExternal(url).catch(console.error)
  }
}

function createWindow() {
  const win = new BrowserWindow({
    title: '知识箱',
    icon: path.join(app.getAppPath(), 'dist', 'app.ico'),
    width: 1280,
    height: 860,
    minWidth: 760,
    minHeight: 520,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  mainWindow = win
  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    event.preventDefault()
    openExternal(url)
  })
  win.once('ready-to-show', () => win.show())
  win.on('closed', () => { mainWindow = undefined })
  void win.loadURL(appUrl).catch((error) => {
    dialog.showErrorBox('知识箱启动失败', error.message)
    app.quit()
  })
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow?.isMinimized()) mainWindow.restore()
    mainWindow?.focus()
  })

  void app.whenReady().then(() => {
    serveApp()
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      {
        label: '知识箱',
        submenu: [
          {
            label: '打开本地数据文件夹',
            click: async () => {
              const error = await shell.openPath(dataDir)
              if (error) dialog.showErrorBox('无法打开数据文件夹', error)
            },
          },
          { label: '退出', accelerator: 'Alt+F4', click: () => app.quit() },
        ],
      },
      {
        label: '帮助',
        submenu: [
          { label: `版本 ${app.getVersion()}`, enabled: false },
          { label: '检查更新…', enabled: app.isPackaged, click: () => void checkForUpdates(mainWindow) },
        ],
      },
    ]))
    createWindow()
  })

  app.on('window-all-closed', () => app.quit())
}
