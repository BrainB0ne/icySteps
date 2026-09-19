# icySteps

## Commands

- Install dependencies with `npm install`.
- Run the desktop app in development with `npm run dev`.
- Run production compilation with `npm run build`; run type checks with `npx tsc --noEmit`.
- Produce a Windows installer with `npm run package` after a successful build.
- Build Linux AppImage and Debian packages with `npm run package:linux` from Linux or WSL; the required Linux packaging tools are unavailable on Windows.

## Architecture

- `src/main/` owns SQLite, managed image files, file dialogs, and PDF/HTML export. Keep Node and Electron APIs out of the renderer.
- `src/preload/` is the only renderer-to-main bridge. Add narrowly scoped typed IPC methods to `IcyStepsApi`; never expose arbitrary IPC or filesystem access.
- `src/renderer/` is the React editor and preview. Shared data types belong in `src/shared/types.ts`.
- `src/shared/themes.ts` is the shared palette source; a journey's theme must affect both the renderer and `bookHtml()` exports.
- User data lives under Electron's `userData` directory: `icysteps.sqlite` and copied photo assets in `projects/`. Imported photos must remain managed copies so source-file moves do not break books.
- The default Electron session blocks HTTP(S) and WebSocket requests. Preserve this local-only policy; development permits only the local Vite origin for hot reload.

## Export

- Render the PDF, portable HTML, and ZIP contents from `bookHtml()` in `src/main/index.ts` so all formats share page structure and styling.
- Export the selected journey theme, not a hard-coded palette.
- Portable HTML exports copy photo files to an adjacent `*-images/` directory and refer to them with relative URLs. Keep the HTML file and its image directory together; do not add remote fonts, CDNs, analytics, maps, or Polarsteps integrations.
- ZIP export packages that same HTML file and `*-images/` directory into one archive.
