import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { ConvertProgress, ConvertResult, GifSettings, VideoInfo } from '@shared/types'

const CHANNELS = {
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

const api = {
  /**
   * Electron 32 removed the non-standard `File.path` property, so a dropped
   * file's location must come from webUtils. This is the documented pattern:
   * the File object is passed across the bridge and resolved here.
   */
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),

  openVideo: (): Promise<string | null> => ipcRenderer.invoke(CHANNELS.openVideo),

  probe: (filePath: string): Promise<VideoInfo> => ipcRenderer.invoke(CHANNELS.probe, filePath),

  mediaUrl: (filePath: string): Promise<string> => ipcRenderer.invoke(CHANNELS.mediaUrl, filePath),

  suggestOutput: (sourcePath: string): Promise<string> =>
    ipcRenderer.invoke(CHANNELS.suggestOutput, sourcePath),

  chooseOutput: (defaultPath: string): Promise<string | null> =>
    ipcRenderer.invoke(CHANNELS.chooseOutput, defaultPath),

  convert: (jobId: string, settings: GifSettings, outputPath: string): Promise<ConvertResult> =>
    ipcRenderer.invoke(CHANNELS.convert, jobId, settings, outputPath),

  cancel: (jobId: string): Promise<boolean> => ipcRenderer.invoke(CHANNELS.cancel, jobId),

  revealFile: (filePath: string): Promise<void> => ipcRenderer.invoke(CHANNELS.revealFile, filePath),

  openFile: (filePath: string): Promise<void> => ipcRenderer.invoke(CHANNELS.openFile, filePath),

  onProgress: (cb: (p: ConvertProgress) => void): (() => void) => {
    const listener = (_e: unknown, p: ConvertProgress): void => cb(p)
    ipcRenderer.on(CHANNELS.progress, listener)
    return () => ipcRenderer.off(CHANNELS.progress, listener)
  },

  onRequestOpen: (cb: () => void): (() => void) => {
    const listener = (): void => cb()
    ipcRenderer.on(CHANNELS.requestOpen, listener)
    return () => ipcRenderer.off(CHANNELS.requestOpen, listener)
  }
}

export type VidGifApi = typeof api

contextBridge.exposeInMainWorld('vidgif', api)
