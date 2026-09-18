# icySteps

## Commands

- Install dependencies with `npm install`.
- Run the desktop app in development with `npm run dev`.
- Run production compilation with `npm run build`; run type checks with `npx tsc --noEmit`.
- Produce a Windows installer with `npm run package` after a successful build.

## Architecture

- `src/main/` owns SQLite, managed image files, file dialogs, and PDF/HTML export. Keep Node and Electron APIs out of the renderer.
- `src/preload/` is the only renderer-to-main bridge. Add narrowly scoped typed IPC methods to `IcyStepsApi`; never expose arbitrary IPC or filesystem access.
- `src/renderer/` is the React editor and preview. Shared data types belong in `src/shared/types.ts`.
- User data lives under Electron's `userData` directory: `icysteps.sqlite` and copied photo assets in `projects/`. Imported photos must remain managed copies so source-file moves do not break books.

## Export

- Render the PDF and portable HTML from `bookHtml()` in `src/main/index.ts` so both formats share page structure and styling.
- Portable HTML must be self-contained: embed local photo files as data URLs and do not add remote fonts, CDNs, analytics, maps, or Polarsteps integrations.
