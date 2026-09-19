# icySteps

icySteps is a local-first desktop app for turning a manually recorded journey into a digital travel book.
Add trips, write a chapter for each step, attach photos and captions, then export the finished book as a PDF, portable HTML, or ZIP archive.

It has no connection to any travel service. Everything is created and stored locally.

## Features

- Create and manage multiple journeys.
- Add dated chapters with a place, story, photos, and optional photo captions.
- Choose an optional cover photo from photos already added to the journey.
- Preview the book while editing.
- Export a print-ready A4 PDF.
- Export portable HTML with an adjacent image folder and relative links.
- Export the portable HTML book and images together as a ZIP archive.
- Delete photos, chapters, and journeys. Journey deletion warns before removing all managed data.

## Requirements

- Node.js 22.12 or newer

Windows is required to create the NSIS installer. Linux packaging requires Linux or WSL.

## Development

```bash
npm install
npm run dev
```

Run production compilation and type checks with:

```bash
npm run build
npx tsc --noEmit
```

## Windows Installer

Create a Windows installer with:

```bash
npm run package
```

The installer is written to `dist/icySteps Setup 0.1.0.exe` for the current app version.

## Linux Packages

Build the AppImage and Debian package on Linux or WSL with:

```bash
npm run package:linux
```

The artifacts are written to `dist/` as `icySteps-0.1.0.AppImage` and a `.deb` package. Building these formats requires Linux tooling such as `mksquashfs`, so the command cannot complete on Windows alone.

## Exports

PDF export uses the same book template as HTML export, with A4 print styling.

An HTML export named `My Journey.html` is accompanied by an image folder:

```text
My Journey.html
My Journey-images/
```

Keep the HTML file and its `-images` folder together when moving or sharing the book. The export contains no remote fonts, CDNs, analytics, maps, or third-party integrations.

`Export ZIP` packages that same HTML file and image folder into one archive. Portable HTML and ZIP photos are clickable and open in a full-window local overlay.

## Local Data

icySteps stores its SQLite database and managed copies of imported photos in Electron's per-user application-data directory. Imported photos are copied there so books remain intact when the original files are moved or deleted.
