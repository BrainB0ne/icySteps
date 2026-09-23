# icySteps

icySteps is a local-first desktop app for turning a manually recorded journey into a digital travel book.
Add trips, write a chapter for each step, attach photos and captions, then export the finished book as a PDF, portable HTML, or ZIP archive.

It has no connection to any travel service. Everything is created and stored locally.

**icySteps is vibe-coded with OpenCode: GPT 5.6 - Terra 🤖**

## Features

- Create and manage multiple journeys.
- Add dated chapters with a place, story, photos, and optional photo captions.
- Choose an optional cover photo from photos already added to the journey.
- Choose a light Azure, Lavender, Blush, or Apricot theme, or a dark Midnight, Evergreen, or Ember theme per journey. The theme applies to the editor, live preview, and exported book.
- Reorder chapters and photos by dragging them; edit captions or remove photos beside each thumbnail.
- Preview the book while editing.
- Export a print-ready A4 PDF.
- Export portable HTML with an adjacent image folder and relative links.
- Export the portable HTML book and images together as a ZIP archive.
- Create an `.icysteps-backup` archive containing all journeys, the SQLite database, and managed photos; restore it on another computer or after data loss.
- Delete photos, chapters, and journeys with in-editor confirmations; Cancel keeps your data and returns to editing.

## Screenshot
![icySteps Intro Screenshot](./screenshots/icysteps-screenshot-intro.png)

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

The installer is written to `dist/icySteps Setup <version>.exe` (for example, `icySteps Setup 0.2.0.exe`).

## Linux Packages

Build the AppImage and Debian package on Linux or WSL with:

```bash
npm run package:linux
```

The artifacts are written to `dist/` as `icySteps-<version>.AppImage` and `icysteps_<version>_amd64.deb`. Building these formats requires Linux tooling such as `mksquashfs`, so the command cannot complete on Windows alone.

To generate individual SHA-256 checksums for the packages in `dist/` and a combined `dist/SHA256SUMS` file, run `make-checksums.bat` on Windows or `./make-checksums.sh` on Linux after building the packages.

## Exports

PDF export uses the same book template as HTML export, with A4 print styling.

An HTML export named `My Journey.html` is accompanied by an image folder:

```text
My Journey.html
My Journey-images/
```

Keep the HTML file and its `-images` folder together when moving or sharing the book. The export contains no remote fonts, CDNs, analytics, maps, or third-party integrations.

`Export ZIP` packages that same HTML file and image folder into one archive. PDF, HTML, and ZIP exports auto-orient photos, cap them at 2000 pixels on the long edge, and encode them as WebP at quality 82 to reduce file sizes. Portable HTML and ZIP photos are clickable and open in a full-window local overlay.

## Backups

`Create backup` writes a portable `.icysteps-backup` ZIP archive containing the complete SQLite database and all managed photo files. Its default name uses the local timestamp, for example `icySteps-20260919_143225.icysteps-backup`. `Restore backup` replaces the current local database and managed photos with the selected archive after confirmation, updating managed photo paths for the current platform. Restoring is destructive, so create a fresh backup first if you need to preserve the current data.

## License

icySteps is released under the [GNU General Public License v3.0](LICENSE).

## Local Data

icySteps stores its SQLite database and managed copies of imported photos in Electron's per-user application-data directory. Imported photos are copied there so books remain intact when the original files are moved or deleted.
