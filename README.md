# VidGif

A simple, clean video → GIF maker for macOS and Windows.

Drop in a video, trim it, tweak a few knobs, get a good-looking GIF.

## Everything is local

Nothing is installed globally. `npm install` writes to `./node_modules`, and the
large binary downloads are pinned into `./.cache`:

| What | Where |
|---|---|
| ffmpeg (~82 MB) | `node_modules/ffmpeg-static/` |
| Electron runtime (~138 MB) | `.cache/electron/` |
| electron-builder tools | `.cache/electron-builder/` |

There is **no global ffmpeg dependency** — the binary is bundled into the app,
so the built installer works on machines that have never heard of ffmpeg.

The one thing left at its default is npm's own package cache, which is a shared
content-addressed store rather than project state. To pin that here too, add
`cache=./.cache/npm` to `.npmrc`.

## Getting started

```bash
npm install
```

```bash
npm run dev
```

`npm install` downloads the ffmpeg and Electron binaries for **the machine it
runs on**. So `node_modules` is not portable between the Mac and the PC — commit
`package-lock.json`, run `npm install` separately on each, and never copy
`node_modules` across.

## Building installers

Each platform must be built on that platform — a `.dmg` cannot be produced from
Windows.

```bash
npm run build:win
```

```bash
npm run build:mac
```

Output lands in `dist/`. Use `pack:win` / `pack:mac` for an unpacked folder
(faster, no installer) when you just want to test the packaged app.

Builds are unsigned, so on macOS the first launch needs right-click → Open.

## How the GIFs are made

A plain `ffmpeg -i in.mp4 out.gif` uses a fixed 216-colour palette and produces
visibly banded output. VidGif runs the two-pass approach instead:

1. **`palettegen`** analyses the trimmed clip and builds an optimal colour table.
   `stats_mode=diff` weights it toward the pixels that actually move.
2. **`paletteuse`** encodes with that table. `diff_mode=rectangle` lets the
   encoder leave untouched regions alone between frames, which is the biggest
   single file-size win available.

The filter chain is ordered `crop → setpts → fps → scale`, so each stage handles
as few pixels as possible, and `reverse` runs last because it buffers every
frame in memory.

Quality presets map to palette size and dithering:

| Preset | Colours | Dither |
|---|---|---|
| Small | 64 | `bayer:bayer_scale=5` |
| Balanced | 160 | `bayer:bayer_scale=3` |
| High | 256 | `sierra2_4a` |

## Layout

```
src/
├── main/            Electron main process
│   ├── filters.ts       pure GifSettings → ffmpeg args
│   ├── ffmpeg.ts        binary resolution, spawn, probe, progress
│   ├── convert.ts       two-pass orchestration, cancel, temp cleanup
│   ├── media-protocol.ts  vidgif-media:// with Range support
│   └── ipc.ts
├── preload/         contextBridge → window.vidgif
├── shared/          types + geometry maths used by BOTH sides
└── renderer/        React UI (Tailwind, Stone palette)
```

`shared/geometry.ts` is the single source of truth for output dimensions and
frame counts, so the numbers in the UI always match what ffmpeg is told to do.

## Two things worth knowing

**Packaging.** A binary cannot execute from inside `app.asar`. `ffmpeg-static` is
listed under `asarUnpack` in `electron-builder.yml`, and `src/main/ffmpeg.ts`
rewrites the path to `app.asar.unpacked` to match. Both halves are required —
change one and `npm run dev` keeps working while the installed app breaks.

**Codecs.** Chromium can't decode every codec (HEVC from iPhones on Windows being
the usual case). Duration and dimensions are therefore read from ffmpeg rather
than the `<video>` element, so such files are still fully convertible — only the
on-screen preview is unavailable, and the UI says so.

## Shortcuts

| Key | Action |
|---|---|
| `Cmd/Ctrl + O` | Open video |
| `Space` | Play / pause |
| `Enter` | Create GIF |
| `Esc` | Cancel conversion |

## Licence note

`ffmpeg-static` ships GPL-licensed ffmpeg builds. Fine for personal use; worth a
look before distributing the app publicly.
