/**
 * A custom `vidgif-media://` scheme for showing local videos and GIFs.
 *
 * Why not just `file://`? In dev the renderer is served from http://localhost,
 * and Chromium blocks file:// subresources from an http origin. Disabling
 * webSecurity would "fix" it by turning off the sandbox everywhere, which is
 * not a trade worth making.
 *
 * Range requests are implemented by hand because the <video> element needs 206
 * responses to seek — without them the trim scrubber can only play from the
 * start. Electron's net.fetch(file://) does not handle Range for us.
 */
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { extname } from 'node:path'
import { protocol } from 'electron'

export const MEDIA_SCHEME = 'vidgif-media'
const PREFIX = `${MEDIA_SCHEME}://local/media?p=`

/**
 * Build a URL the renderer can hand to <video src> or <img src>.
 *
 * The file path travels as a QUERY PARAMETER, not a path segment: the scheme is
 * registered as `standard`, and standard schemes get their paths normalised —
 * which decodes the %2F separators in an encoded Windows path and mangles it.
 * Query strings are passed through untouched.
 */
export function mediaUrl(absolutePath: string): string {
  return PREFIX + encodeURIComponent(absolutePath)
}

const MIME: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/x-m4v',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.gif': 'image/gif'
}

function mimeFor(path: string): string {
  return MIME[extname(path).toLowerCase()] ?? 'application/octet-stream'
}

function webStream(path: string, start?: number, end?: number): ReadableStream {
  const node = createReadStream(path, start === undefined ? {} : { start, end })
  return Readable.toWeb(node) as ReadableStream
}

/** Must run before app.whenReady(). */
export function registerMediaScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: MEDIA_SCHEME,
      privileges: {
        // `standard` is required: Chromium refuses to do byte-range media
        // loading on a non-standard scheme, and <video> fails with
        // MEDIA_ERR_SRC_NOT_SUPPORTED before the handler is ever consulted.
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        bypassCSP: true,
        corsEnabled: true
      }
    }
  ])
}

/** Must run after app.whenReady(). */
export function handleMediaScheme(): void {
  protocol.handle(MEDIA_SCHEME, async (request) => {
    let filePath: string | null
    try {
      filePath = new URL(request.url).searchParams.get('p')
    } catch {
      return new Response('Bad request', { status: 400 })
    }
    if (!filePath) return new Response('Bad request', { status: 400 })

    let size: number
    try {
      size = (await stat(filePath)).size
    } catch {
      return new Response('Not found', { status: 404 })
    }

    const type = mimeFor(filePath)
    const range = request.headers.get('Range')
    const match = range ? /bytes=(\d*)-(\d*)/.exec(range) : null

    if (!match) {
      return new Response(webStream(filePath), {
        status: 200,
        headers: { 'Content-Type': type, 'Content-Length': String(size), 'Accept-Ranges': 'bytes' }
      })
    }

    const start = match[1] ? Number(match[1]) : 0
    const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1

    if (Number.isNaN(start) || start >= size || end < start) {
      return new Response('Range not satisfiable', {
        status: 416,
        headers: { 'Content-Range': `bytes */${size}` }
      })
    }

    return new Response(webStream(filePath, start, end), {
      status: 206,
      headers: {
        'Content-Type': type,
        'Content-Length': String(end - start + 1),
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Accept-Ranges': 'bytes'
      }
    })
  })
}
