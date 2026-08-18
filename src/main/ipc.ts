import { basename, dirname, join, parse } from 'node:path'
import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import type { ConvertProgress, ConvertResult, GifSettings } from '@shared/types'
import { cancelJob, convert } from './convert'
import { probeVideo } from './ffmpeg'
import { mediaUrl } from './media-protocol'

export const CHANNELS = {
  openVideo: 'vidgif:open-video',
  probe: 'vidgif:probe',
  mediaUrl: 'vidgif:media-url',
  chooseOutput: 'vidgif:choose-output',
  suggestOutput: 'vidgif:suggest-output',
  convert: 'vidgif:convert',
  cancel: 'vidgif:cancel',
  progress: 'vidgif:progress',
  revealFile: 'vidgif:reveal-file',
  openFile: 'vidgif:open-file',
  requestOpen: 'vidgif:request-open'
} as const

const VIDEO_EXTENSIONS = ['mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi']

export function registerIpc(): void {
  ipcMain.handle(CHANNELS.openVideo, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Video', extensions: VIDEO_EXTENSIONS }]
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle(CHANNELS.probe, async (_e, filePath: string) => {
    const info = await probeVideo(filePath)
    return { ...info, path: filePath, name: basename(filePath) }
  })

  ipcMain.handle(CHANNELS.mediaUrl, (_e, filePath: string) => mediaUrl(filePath))

  /** Default save target: alongside the source, same basename, .gif */
  ipcMain.handle(CHANNELS.suggestOutput, (_e, sourcePath: string) =>
    join(dirname(sourcePath), `${parse(sourcePath).name}.gif`)
  )

  ipcMain.handle(CHANNELS.chooseOutput, async (_e, defaultPath: string) => {
    const result = await dialog.showSaveDialog({
      defaultPath,
      filters: [{ name: 'GIF', extensions: ['gif'] }]
    })
    return result.canceled ? null : result.filePath
  })

  // The renderer supplies the job id so it can cancel a job that is still
  // running — this handler does not resolve until the conversion is finished.
  ipcMain.handle(
    CHANNELS.convert,
    async (event, jobId: string, settings: GifSettings, outputPath: string): Promise<ConvertResult> => {
      const sender = event.sender
      return convert(jobId, settings, outputPath, (p: ConvertProgress) => {
        if (!sender.isDestroyed()) sender.send(CHANNELS.progress, p)
      })
    }
  )

  ipcMain.handle(CHANNELS.cancel, (_e, jobId: string) => cancelJob(jobId))

  ipcMain.handle(CHANNELS.revealFile, (_e, filePath: string) => {
    shell.showItemInFolder(filePath)
  })

  ipcMain.handle(CHANNELS.openFile, async (_e, filePath: string) => {
    await shell.openPath(filePath)
  })
}

/** Used by the application menu to drive the renderer's file picker. */
export function requestOpenInRenderer(window: BrowserWindow | null): void {
  window?.webContents.send(CHANNELS.requestOpen)
}
