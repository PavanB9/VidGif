/// <reference types="vite/client" />

import type { VidGifApi } from '../preload'

declare global {
  interface Window {
    vidgif: VidGifApi
  }
}

export {}
