import { app, BrowserWindow, dialog, ipcMain, Menu, net, protocol, session } from 'electron'
import { ZipArchive } from 'archiver'
import { once } from 'node:events'
import { createWriteStream } from 'node:fs'
import Database from 'better-sqlite3'
import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { v4 as uuid } from 'uuid'
import type { Photo, Step, Trip } from '../shared/types'
import { themes, type ThemeId } from '../shared/themes'

let mainWindow: BrowserWindow
let db: Database.Database
let dataDirectory = ''

Menu.setApplicationMenu(null)

const now = () => new Date().toISOString()
const photoUrl = (path: string) => `icy-photo://${Buffer.from(path).toString('base64url')}`
const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)
const formatDate = (value: string) => value ? new Intl.DateTimeFormat('en', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${value}T00:00:00`)) : ''
const tripDates = (trip: Trip) => [formatDate(trip.startDate), formatDate(trip.endDate)].filter(Boolean).join(' - ')

function initialiseDatabase() {
  dataDirectory = join(app.getPath('userData'), 'projects')
  db = new Database(join(app.getPath('userData'), 'icysteps.sqlite'))
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS trips (id TEXT PRIMARY KEY, title TEXT NOT NULL, subtitle TEXT NOT NULL DEFAULT '', start_date TEXT NOT NULL DEFAULT '', end_date TEXT NOT NULL DEFAULT '', theme TEXT NOT NULL DEFAULT 'azure', cover_photo_id TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS steps (id TEXT PRIMARY KEY, trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE, title TEXT NOT NULL DEFAULT '', body TEXT NOT NULL DEFAULT '', place_name TEXT NOT NULL DEFAULT '', occurred_at TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS photos (id TEXT PRIMARY KEY, step_id TEXT NOT NULL REFERENCES steps(id) ON DELETE CASCADE, file_name TEXT NOT NULL, file_path TEXT NOT NULL, caption TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL);
  `)
  try { db.exec("ALTER TABLE trips ADD COLUMN cover_photo_id TEXT NOT NULL DEFAULT ''") } catch (error) { if (!(error instanceof Error) || !error.message.includes('duplicate column name')) throw error }
  try { db.exec("ALTER TABLE trips ADD COLUMN theme TEXT NOT NULL DEFAULT 'azure'") } catch (error) { if (!(error instanceof Error) || !error.message.includes('duplicate column name')) throw error }
}

function listTrips(): Trip[] {
  const trips = db.prepare('SELECT id, title, subtitle, start_date as startDate, end_date as endDate, theme, cover_photo_id as coverPhotoId, created_at as createdAt FROM trips ORDER BY created_at DESC').all() as Trip[]
  const stepsForTrip = db.prepare('SELECT id, trip_id as tripId, title, body, place_name as placeName, occurred_at as occurredAt, sort_order as sortOrder FROM steps WHERE trip_id = ? ORDER BY sort_order')
  const photosForStep = db.prepare('SELECT id, step_id as stepId, file_name as fileName, file_path, caption, sort_order as sortOrder FROM photos WHERE step_id = ? ORDER BY sort_order')
  return trips.map((trip) => ({ ...trip, steps: (stepsForTrip.all(trip.id) as Step[]).map((step) => ({ ...step, photos: (photosForStep.all(step.id) as Array<Photo & { file_path: string }>).map(({ file_path, ...photo }) => ({ ...photo, path: photoUrl(file_path) })) })) }))
}

function bookHtml(trip: Trip, layout: 'print' | 'web' = 'print') {
  const theme = themes[trip.theme as ThemeId] ?? themes.azure
  const coverPhoto = trip.steps.flatMap((step) => step.photos).find((photo) => photo.id === trip.coverPhotoId)
  const appVersion = app.getVersion()
  const renderPhoto = (photo: Photo, step: Step) => {
    const image = `<img src="${escape(photo.path)}" alt="${escape(photo.caption || step.title)}" />`
    return layout === 'web' ? `<button class="photo-button" type="button" data-full-photo="${escape(photo.path)}" data-full-alt="${escape(photo.caption || step.title)}" aria-label="Open ${escape(photo.caption || step.title || 'photo')} larger">${image}</button>` : image
  }
  const pages = trip.steps.map((step) => `
    <article class="step" id="step-${step.id}"><div class="step-frame">
      <div class="step-meta">${escape(step.occurredAt || 'Undated')} ${step.placeName ? `<span>/</span> ${escape(step.placeName)}` : ''}</div>
      <h2>${escape(step.title || 'A moment worth keeping')}</h2>
      ${step.body ? `<p>${escape(step.body).replace(/\n/g, '<br>')}</p>` : ''}
       ${step.photos.length ? `<div class="photos ${step.photos.length === 1 ? 'single' : ''}">${step.photos.map((photo) => `<figure>${renderPhoto(photo, step)}${photo.caption ? `<figcaption>${escape(photo.caption)}</figcaption>` : ''}</figure>`).join('')}</div>` : ''}
    </div></article>`).join('')
  const dates = tripDates(trip)
  const contents = trip.steps.length ? `<section class="contents"><div class="contents-frame"><div class="contents-kicker">Travel book</div><h2>Contents</h2><ol>${trip.steps.map((step, index) => `<li><a href="#step-${step.id}"><span class="contents-number">${String(index + 1).padStart(2, '0')}</span><span class="contents-title">${escape(step.title || 'Untitled moment')}</span><span class="contents-date">${escape(step.occurredAt || 'Undated')}</span></a></li>`).join('')}</ol></div></section>` : ''
  const lightbox = layout === 'web' ? `<style>
    .web .photo-button { display: block; width: 100%; padding: 0; border: 0; background: transparent; cursor: zoom-in; text-align: inherit; } .web .photo-button img { pointer-events: none; } .photo-lightbox { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 32px; background: #102630e8; } .photo-lightbox[hidden] { display: none; } .photo-lightbox img { display: block; width: auto; max-width: calc(100vw - 64px); height: auto; max-height: calc(100vh - 96px); object-fit: contain; background: transparent; } .photo-lightbox-close { position: absolute; top: 18px; right: 18px; padding: 9px 12px; border: 1px solid #d9eceb; border-radius: 4px; background: #fff; color: #19303b; font: 14px ui-sans-serif, sans-serif; cursor: pointer; } body.lightbox-open { overflow: hidden; }
  </style><div class="photo-lightbox" hidden role="dialog" aria-modal="true" aria-label="Enlarged photo"><button class="photo-lightbox-close" type="button" aria-label="Close enlarged photo">Close</button><img alt="" /></div><script>
    (() => { const lightbox = document.querySelector('.photo-lightbox'); const image = lightbox.querySelector('img'); const close = () => { lightbox.hidden = true; document.body.classList.remove('lightbox-open'); }; document.querySelectorAll('.photo-button').forEach((button) => button.addEventListener('click', () => { image.src = button.dataset.fullPhoto; image.alt = button.dataset.fullAlt; lightbox.hidden = false; document.body.classList.add('lightbox-open'); })); lightbox.querySelector('.photo-lightbox-close').addEventListener('click', close); lightbox.addEventListener('click', (event) => { if (event.target === lightbox) close(); }); document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !lightbox.hidden) close(); }); })();
  </script>` : ''
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escape(trip.title)}</title><style>
    @page { size: A4; margin: 12mm; } * { box-sizing: border-box; } body { margin: 0; color: #182733; font-family: Georgia, serif; font-size: 11pt; line-height: 1.65; } .cover { min-height: 273mm; display: flex; flex-direction: column; justify-content: flex-end; padding: 18mm; border: 1px solid #193b49; background: linear-gradient(150deg,#d9f3f1 0%,#c4deec 52%,#45677b 100%); break-after: page; } .cover h1 { margin: 0; font-size: 46pt; line-height: .95; letter-spacing: -.06em; max-width: 78%; } .cover-subtitle { font: 10pt ui-sans-serif, sans-serif; letter-spacing: .14em; text-transform: uppercase; margin: 18px 0 0; } .cover-dates { margin: 6px 0 0; color: #31596d; font: 10pt ui-sans-serif, sans-serif; } .step { break-before: page; min-height: 273mm; padding: 0; } .step-frame { min-height: 273mm; padding: 18mm; border: 1px solid #8aa8a9; background: #fff; } .step-meta { color: #527c87; font: 9pt ui-sans-serif, sans-serif; letter-spacing: .12em; text-transform: uppercase; } .step-meta span { color: #a8b8b5; padding: 0 2mm; } h2 { font-size: 29pt; line-height: 1.04; letter-spacing: -.04em; margin: 9mm 0 7mm; max-width: 13em; } p { max-width: 39em; margin: 0; } .photos { margin-top: 12mm; } figure { margin: 0 0 7mm; break-inside: avoid; } img { display: block; width: auto; max-width: 100%; height: auto; max-height: 112mm; background: #edf3f2; } .single img { max-height: 145mm; } figcaption { font: italic 9pt Georgia, serif; padding-top: 2.5mm; color: #52636b; } body.linux { font-family: "Noto Serif", "DejaVu Serif", serif; } .linux .cover-subtitle, .linux .cover-dates, .linux .step-meta { font-family: "Noto Sans", "DejaVu Sans", sans-serif; } .linux figcaption { font-family: "Noto Serif", "DejaVu Serif", serif; } body.web { max-width: 1180px; margin: 0 auto; padding: 18px; background: #edf3f2; } .web .cover { min-height: min(80vh, 760px); margin-bottom: 18px; break-after: auto; } .web .step { min-height: 0; margin-bottom: 18px; break-before: auto; } .web .step-frame { min-height: 0; } .web .photos { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 18px; } .web .photos figure { flex: 1 1 300px; margin: 0; } .web .photos.single figure { flex-basis: 100%; } .web .photos img { width: 100%; height: auto; max-height: 520px; object-fit: contain; } @media (max-width: 620px) { body.web { padding: 8px; } .web .cover, .web .step-frame { padding: 28px; } .web .photos figure { flex-basis: 100%; } } @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style><style>body { color: ${theme.ink}; } body.web { background: ${theme.appBackground}; } .cover { border-color: ${theme.border}; background: ${theme.cover}; } .cover.has-photo { position: relative; overflow: hidden; color: #fff; } .cover-image { position: absolute; inset: 0; width: 100%; max-height: none; height: 100%; object-fit: cover; filter: brightness(.68); } .cover.has-photo .cover-dates { color: #e2f0ef; } .cover-content { position: relative; z-index: 1; text-shadow: 0 1px 12px #10263099; } .cover-credit { margin: 16mm 0 0; color: ${theme.accent}; font: 8pt ui-sans-serif, sans-serif; letter-spacing: .08em; } .cover.has-photo .cover-credit { color: #e2f0ef; } .contents { min-height: 273mm; break-after: page; } .contents-frame { min-height: 273mm; padding: 18mm; border: 1px solid ${theme.border}; background: #fff; } .contents-kicker { color: ${theme.accent}; font: 9pt ui-sans-serif, sans-serif; letter-spacing: .12em; text-transform: uppercase; } .contents h2 { margin: 9mm 0 12mm; } .contents ol { margin: 0; padding: 0; list-style: none; } .contents li { border-top: 1px solid ${theme.border}; } .contents li:last-child { border-bottom: 1px solid ${theme.border}; } .contents a { display: grid; grid-template-columns: 14mm minmax(0, 1fr) auto; gap: 5mm; align-items: baseline; padding: 5mm 0; color: inherit; text-decoration: none; } .contents-number, .contents-date { color: ${theme.accent}; font: 9pt ui-sans-serif, sans-serif; letter-spacing: .08em; } .contents-title { font-size: 15pt; line-height: 1.2; } .step { scroll-margin-top: 18px; } .step-frame { border-color: ${theme.border}; } .step-meta { color: ${theme.accent}; } .photos img { background: ${theme.appBackground}; } .web .contents { min-height: 0; margin-bottom: 18px; break-after: auto; } .web .contents-frame { min-height: 0; } .web .contents a:hover .contents-title { color: ${theme.accent}; text-decoration: underline; } @media (max-width: 620px) { .contents-frame { padding: 28px; } .contents a { grid-template-columns: 9mm minmax(0, 1fr); } .contents-date { grid-column: 2; } }</style></head><body class="${layout}${process.platform === 'linux' ? ' linux' : ''}"><section class="cover${coverPhoto ? ' has-photo' : ''}">${coverPhoto ? `<img class="cover-image" src="${escape(coverPhoto.path)}" alt="" />` : ''}<div class="cover-content"><h1>${escape(trip.title || 'Untitled journey')}</h1><p class="cover-subtitle">${escape(trip.subtitle || 'A travel book by icySteps')}</p>${dates ? `<p class="cover-dates">${escape(dates)}</p>` : ''}<p class="cover-credit">Created with icySteps v${escape(appVersion)}</p></div></section>${contents}${pages}${lightbox}</body></html>`
}

async function linkedBookHtml(trip: Trip, imageDirectory: string, imageDirectoryName: string) {
  const linked = structuredClone(trip)
  await mkdir(imageDirectory, { recursive: true })
  for (const step of linked.steps) {
    for (const photo of step.photos) {
      const source = Buffer.from(new URL(photo.path).hostname, 'base64url').toString()
      await copyFile(source, join(imageDirectory, photo.fileName))
      photo.path = `${encodeURIComponent(imageDirectoryName)}/${encodeURIComponent(photo.fileName)}`
    }
  }
  return bookHtml(linked, 'web')
}

async function zipBookHtml(trip: Trip, outputPath: string, bookName: string) {
  const imageDirectoryName = `${bookName}-images`
  const linked = structuredClone(trip)
  const output = createWriteStream(outputPath)
  const archive = new ZipArchive({ zlib: { level: 9 } })
  const completed = once(output, 'close')

  archive.on('error', (error: Error) => output.destroy(error))
  archive.pipe(output)
  for (const step of linked.steps) {
    for (const photo of step.photos) {
      const source = Buffer.from(new URL(photo.path).hostname, 'base64url').toString()
      archive.file(source, { name: `${imageDirectoryName}/${photo.fileName}` })
      photo.path = `${encodeURIComponent(imageDirectoryName)}/${encodeURIComponent(photo.fileName)}`
    }
  }
  archive.append(bookHtml(linked, 'web'), { name: `${bookName}.html` })
  await archive.finalize()
  await completed
}

async function createWindow() {
  mainWindow = new BrowserWindow({ width: 1440, height: 900, minWidth: 900, minHeight: 650, backgroundColor: '#f4f8f7', webPreferences: { preload: join(__dirname, '../preload/index.js'), contextIsolation: true, sandbox: true, spellcheck: false } })
  if (process.env.ELECTRON_RENDERER_URL) await mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  else await mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
}

app.whenReady().then(async () => {
  const developmentOrigin = process.env.ELECTRON_RENDERER_URL ? new URL(process.env.ELECTRON_RENDERER_URL).origin : null
  // Keep the packaged editor local-only while permitting Vite's local dev server and HMR.
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (details, callback) => {
    callback({ cancel: new URL(details.url).origin !== developmentOrigin })
  })
  protocol.handle('icy-photo', (request) => net.fetch(pathToFileURL(Buffer.from(new URL(request.url).hostname, 'base64url').toString()).toString()))
  initialiseDatabase()
  ipcMain.handle('app:version', () => app.getVersion())
  ipcMain.handle('app:platform', () => process.platform)
  await createWindow()

  ipcMain.handle('trips:list', () => listTrips())
  ipcMain.handle('trips:create', (_, title: string) => { const trip = { id: uuid(), title: title.trim() || 'Untitled journey', subtitle: '', startDate: '', endDate: '', theme: 'azure' as ThemeId, coverPhotoId: '', createdAt: now(), steps: [] }; db.prepare('INSERT INTO trips (id, title, subtitle, start_date, end_date, theme, cover_photo_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(trip.id, trip.title, '', '', '', trip.theme, '', trip.createdAt); return trip })
  ipcMain.handle('trips:save', (_, trip: Pick<Trip, 'id' | 'title' | 'subtitle' | 'startDate' | 'endDate' | 'theme' | 'coverPhotoId'>) => db.prepare('UPDATE trips SET title=?, subtitle=?, start_date=?, end_date=?, theme=?, cover_photo_id=? WHERE id=?').run(trip.title, trip.subtitle, trip.startDate, trip.endDate, trip.theme, trip.coverPhotoId, trip.id))
  ipcMain.handle('trips:delete', async (_, tripId: string) => {
    const trip = db.prepare('SELECT title FROM trips WHERE id=?').get(tripId) as { title: string } | undefined
    if (!trip) return false
    const answer = await dialog.showMessageBox(mainWindow, { type: 'warning', buttons: ['Cancel', 'Delete journey'], defaultId: 0, cancelId: 0, message: `Delete “${trip.title}”?`, detail: 'This permanently deletes the journey, all of its steps, and every managed photo. This cannot be undone.' })
    if (answer.response !== 1) return false
    const photos = db.prepare('SELECT file_path FROM photos WHERE step_id IN (SELECT id FROM steps WHERE trip_id=?)').all(tripId) as Array<{ file_path: string }>
    db.transaction(() => { db.prepare('DELETE FROM photos WHERE step_id IN (SELECT id FROM steps WHERE trip_id=?)').run(tripId); db.prepare('DELETE FROM steps WHERE trip_id=?').run(tripId); db.prepare('DELETE FROM trips WHERE id=?').run(tripId) })()
    await Promise.all(photos.map((photo) => rm(photo.file_path, { force: true })))
    return true
  })
  ipcMain.handle('steps:create', (_, tripId: string) => { const order = (db.prepare('SELECT COUNT(*) as count FROM steps WHERE trip_id=?').get(tripId) as { count: number }).count; const step: Step = { id: uuid(), tripId, title: '', body: '', placeName: '', occurredAt: '', sortOrder: order, photos: [] }; db.prepare('INSERT INTO steps VALUES (?, ?, ?, ?, ?, ?, ?)').run(step.id, tripId, '', '', '', '', order); return step })
  ipcMain.handle('steps:save', (_, step: Step) => db.prepare('UPDATE steps SET title=?, body=?, place_name=?, occurred_at=? WHERE id=?').run(step.title, step.body, step.placeName, step.occurredAt, step.id))
  ipcMain.handle('steps:delete', async (_, stepId: string) => {
    const photos = db.prepare('SELECT file_path FROM photos WHERE step_id=?').all(stepId) as Array<{ file_path: string }>
    db.transaction(() => { db.prepare('UPDATE trips SET cover_photo_id=\'\' WHERE cover_photo_id IN (SELECT id FROM photos WHERE step_id=?)').run(stepId); db.prepare('DELETE FROM photos WHERE step_id=?').run(stepId); db.prepare('DELETE FROM steps WHERE id=?').run(stepId) })()
    await Promise.all(photos.map((photo) => rm(photo.file_path, { force: true })))
  })
  ipcMain.handle('photos:import', async (_, stepId: string) => {
    const selected = await dialog.showOpenDialog(mainWindow, { title: 'Add photos', properties: ['openFile', 'multiSelections'], filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'heic'] }] })
    if (selected.canceled) return []
    const target = join(dataDirectory, stepId); await mkdir(target, { recursive: true })
    const start = (db.prepare('SELECT COUNT(*) as count FROM photos WHERE step_id=?').get(stepId) as { count: number }).count
    return Promise.all(selected.filePaths.map(async (source, index) => { const id = uuid(); const fileName = `${id}-${basename(source)}`; const filePath = join(target, fileName); await copyFile(source, filePath); db.prepare('INSERT INTO photos VALUES (?, ?, ?, ?, ?, ?)').run(id, stepId, fileName, filePath, '', start + index); return { id, stepId, fileName, path: photoUrl(filePath), caption: '', sortOrder: start + index } }))
  })
  ipcMain.handle('photos:delete', async (_, photoId: string) => {
    const photo = db.prepare('SELECT file_path FROM photos WHERE id=?').get(photoId) as { file_path: string } | undefined
    if (!photo) return
    db.transaction(() => { db.prepare('UPDATE trips SET cover_photo_id=\'\' WHERE cover_photo_id=?').run(photoId); db.prepare('DELETE FROM photos WHERE id=?').run(photoId) })()
    await rm(photo.file_path, { force: true })
  })
  ipcMain.handle('photos:save-caption', (_, photoId: string, caption: string) => db.prepare('UPDATE photos SET caption=? WHERE id=?').run(caption, photoId))
  ipcMain.handle('export:pdf', async (_, trip: Trip) => { const output = await dialog.showSaveDialog(mainWindow, { defaultPath: `${trip.title || 'icySteps-book'}.pdf`, filters: [{ name: 'PDF', extensions: ['pdf'] }] }); if (output.canceled || !output.filePath) return null; const window = new BrowserWindow({ show: false, webPreferences: { sandbox: true } }); await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(bookHtml(trip))}`); const pdf = await window.webContents.printToPDF({ preferCSSPageSize: true, printBackground: true }); await writeFile(output.filePath, pdf); window.destroy(); return output.filePath })
  ipcMain.handle('export:html', async (_, trip: Trip) => { const output = await dialog.showSaveDialog(mainWindow, { defaultPath: `${trip.title || 'icySteps-book'}.html`, filters: [{ name: 'HTML', extensions: ['html'] }] }); if (output.canceled || !output.filePath) return null; const imageDirectoryName = `${basename(output.filePath, extname(output.filePath))}-images`; const imageDirectory = join(dirname(output.filePath), imageDirectoryName); await writeFile(output.filePath, await linkedBookHtml(trip, imageDirectory, imageDirectoryName)); return output.filePath })
  ipcMain.handle('export:zip', async (_, trip: Trip) => { const output = await dialog.showSaveDialog(mainWindow, { defaultPath: `${trip.title || 'icySteps-book'}.zip`, filters: [{ name: 'ZIP archive', extensions: ['zip'] }] }); if (output.canceled || !output.filePath) return null; await zipBookHtml(trip, output.filePath, basename(output.filePath, extname(output.filePath))); return output.filePath })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
