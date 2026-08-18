import { join } from 'node:path'
import { app, BrowserWindow, Menu, nativeTheme, shell, type MenuItemConstructorOptions } from 'electron'
import { cleanupAllJobs } from './convert'
import { registerIpc, requestOpenInRenderer } from './ipc'
import { handleMediaScheme, registerMediaScheme } from './media-protocol'

const isMac = process.platform === 'darwin'

// Stone-50 / stone-950 — matches the renderer so there is no white flash on
// launch while the window paints.
const backgroundFor = (): string => (nativeTheme.shouldUseDarkColors ? '#0c0a09' : '#fafaf9')

let mainWindow: BrowserWindow | null = null

// Must be called before the app is ready.
registerMediaScheme()

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1060,
    height: 780,
    minWidth: 900,
    minHeight: 660,
    show: false,
    backgroundColor: backgroundFor(),
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      // webUtils.getPathForFile (used for drag-and-drop) needs a non-sandboxed
      // preload; contextIsolation still keeps the renderer isolated.
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Keep stray navigations and window.open out of the app frame.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    void mainWindow.loadURL(devUrl)
  } else {
    void mainWindow.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  }
}

function buildMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? ([{ role: 'appMenu' }] as MenuItemConstructorOptions[])
      : ([] as MenuItemConstructorOptions[])),
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Video…',
          accelerator: 'CmdOrCtrl+O',
          click: () => requestOpenInRenderer(mainWindow)
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'togglefullscreen' }]
    },
    { role: 'windowMenu' }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// One window only — a second launch focuses the existing one.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  void app.whenReady().then(() => {
    handleMediaScheme()
    registerIpc()
    buildMenu()
    createWindow()

    nativeTheme.on('updated', () => mainWindow?.setBackgroundColor(backgroundFor()))

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (!isMac) app.quit()
  })

  // Kill any in-flight ffmpeg and remove its temp dir rather than leaking both.
  app.on('will-quit', (event) => {
    event.preventDefault()
    void cleanupAllJobs().finally(() => app.exit(0))
  })
}
