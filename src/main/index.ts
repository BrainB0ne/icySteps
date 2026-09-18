import { app, BrowserWindow, dialog, ipcMain, net, protocol } from 'electron'
import Database from 'better-sqlite3'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { v4 as uuid } from 'uuid'
import type { Photo, Step, Trip } from '../shared/types'

let mainWindow: BrowserWindow
let db: Database.Database
let dataDirectory = ''

const now = () => new Date().toISOString()
const photoUrl = (path: string) => `icy-photo://${Buffer.from(path).toString('base64url')}`
const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)

function initialiseDatabase() {
  dataDirectory = join(app.getPath('userData'), 'projects')
  db = new Database(join(app.getPath('userData'), 'icysteps.sqlite'))
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS trips (id TEXT PRIMARY KEY, title TEXT NOT NULL, subtitle TEXT NOT NULL DEFAULT '', start_date TEXT NOT NULL DEFAULT '', end_date TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS steps (id TEXT PRIMARY KEY, trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE, title TEXT NOT NULL DEFAULT '', body TEXT NOT NULL DEFAULT '', place_name TEXT NOT NULL DEFAULT '', occurred_at TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS photos (id TEXT PRIMARY KEY, step_id TEXT NOT NULL REFERENCES steps(id) ON DELETE CASCADE, file_name TEXT NOT NULL, file_path TEXT NOT NULL, caption TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL);
  `)
}

function listTrips(): Trip[] {
  const trips = db.prepare('SELECT id, title, subtitle, start_date as startDate, end_date as endDate, created_at as createdAt FROM trips ORDER BY created_at DESC').all() as Trip[]
  const stepsForTrip = db.prepare('SELECT id, trip_id as tripId, title, body, place_name as placeName, occurred_at as occurredAt, sort_order as sortOrder FROM steps WHERE trip_id = ? ORDER BY sort_order')
  const photosForStep = db.prepare('SELECT id, step_id as stepId, file_name as fileName, file_path, caption, sort_order as sortOrder FROM photos WHERE step_id = ? ORDER BY sort_order')
  return trips.map((trip) => ({ ...trip, steps: (stepsForTrip.all(trip.id) as Step[]).map((step) => ({ ...step, photos: (photosForStep.all(step.id) as Array<Photo & { file_path: string }>).map(({ file_path, ...photo }) => ({ ...photo, path: photoUrl(file_path) })) })) }))
}

function bookHtml(trip: Trip, layout: 'print' | 'web' = 'print') {
  const pages = trip.steps.map((step) => `
    <article class="step"><div class="step-frame">
      <div class="step-meta">${escape(step.occurredAt || 'Undated')} ${step.placeName ? `<span>/</span> ${escape(step.placeName)}` : ''}</div>
      <h2>${escape(step.title || 'A moment worth keeping')}</h2>
      ${step.body ? `<p>${escape(step.body).replace(/\n/g, '<br>')}</p>` : ''}
      ${step.photos.length ? `<div class="photos ${step.photos.length === 1 ? 'single' : ''}">${step.photos.map((photo) => `<figure><img src="${photo.path}" alt="${escape(photo.caption || step.title)}" />${photo.caption ? `<figcaption>${escape(photo.caption)}</figcaption>` : ''}</figure>`).join('')}</div>` : ''}
    </div></article>`).join('')
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escape(trip.title)}</title><style>
    @page { size: A4; margin: 12mm; } * { box-sizing: border-box; } body { margin: 0; color: #182733; font-family: Georgia, serif; font-size: 11pt; line-height: 1.65; } .cover { min-height: 273mm; display: flex; flex-direction: column; justify-content: flex-end; padding: 18mm; border: 1px solid #193b49; background: linear-gradient(150deg,#d9f3f1 0%,#c4deec 52%,#45677b 100%); break-after: page; } .cover h1 { margin: 0; font-size: 46pt; line-height: .95; letter-spacing: -.06em; max-width: 78%; } .cover p { font: 10pt ui-sans-serif, sans-serif; letter-spacing: .14em; text-transform: uppercase; margin: 18px 0 0; } .step { break-before: page; min-height: 273mm; padding: 0; } .step-frame { min-height: 273mm; padding: 18mm; border: 1px solid #8aa8a9; background: #fff; } .step-meta { color: #527c87; font: 9pt ui-sans-serif, sans-serif; letter-spacing: .12em; text-transform: uppercase; } .step-meta span { color: #a8b8b5; padding: 0 2mm; } h2 { font-size: 29pt; line-height: 1.04; letter-spacing: -.04em; margin: 9mm 0 7mm; max-width: 13em; } p { max-width: 39em; margin: 0; } .photos { margin-top: 12mm; } figure { margin: 0 0 7mm; break-inside: avoid; } img { display: block; width: auto; max-width: 100%; height: auto; max-height: 112mm; background: #edf3f2; } .single img { max-height: 145mm; } figcaption { font: italic 9pt Georgia, serif; padding-top: 2.5mm; color: #52636b; } body.web { max-width: 1180px; margin: 0 auto; padding: 18px; background: #edf3f2; } .web .cover { min-height: min(80vh, 760px); margin-bottom: 18px; break-after: auto; } .web .step { min-height: 0; margin-bottom: 18px; break-before: auto; } .web .step-frame { min-height: 0; } .web .photos { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 18px; } .web .photos figure { flex: 1 1 300px; margin: 0; } .web .photos.single figure { flex-basis: 100%; } .web .photos img { width: 100%; height: auto; max-height: 520px; object-fit: contain; } @media (max-width: 620px) { body.web { padding: 8px; } .web .cover, .web .step-frame { padding: 28px; } .web .photos figure { flex-basis: 100%; } } @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style></head><body class="${layout}"><section class="cover"><h1>${escape(trip.title || 'Untitled journey')}</h1><p>${escape(trip.subtitle || 'A travel book by icySteps')}</p></section>${pages}</body></html>`
}

async function portableBookHtml(trip: Trip) {
  const embedded = structuredClone(trip)
  for (const step of embedded.steps) {
    for (const photo of step.photos) {
      const source = Buffer.from(new URL(photo.path).hostname, 'base64url').toString()
      const extension = extname(source).toLowerCase()
      const type = extension === '.png' ? 'image/png' : extension === '.webp' ? 'image/webp' : extension === '.heic' ? 'image/heic' : 'image/jpeg'
      photo.path = `data:${type};base64,${(await readFile(source)).toString('base64')}`
    }
  }
  return bookHtml(embedded, 'web')
}

async function createWindow() {
  mainWindow = new BrowserWindow({ width: 1440, height: 900, minWidth: 900, minHeight: 650, backgroundColor: '#f4f8f7', webPreferences: { preload: join(__dirname, '../preload/index.js'), contextIsolation: true, sandbox: true } })
  if (process.env.ELECTRON_RENDERER_URL) await mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  else await mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
}

app.whenReady().then(async () => {
  protocol.handle('icy-photo', (request) => net.fetch(pathToFileURL(Buffer.from(new URL(request.url).hostname, 'base64url').toString()).toString()))
  initialiseDatabase()
  await createWindow()

  ipcMain.handle('trips:list', () => listTrips())
  ipcMain.handle('trips:create', (_, title: string) => { const trip = { id: uuid(), title: title.trim() || 'Untitled journey', subtitle: '', startDate: '', endDate: '', createdAt: now(), steps: [] }; db.prepare('INSERT INTO trips VALUES (?, ?, ?, ?, ?, ?)').run(trip.id, trip.title, '', '', '', trip.createdAt); return trip })
  ipcMain.handle('trips:save', (_, trip: Pick<Trip, 'id' | 'title' | 'subtitle' | 'startDate' | 'endDate'>) => db.prepare('UPDATE trips SET title=?, subtitle=?, start_date=?, end_date=? WHERE id=?').run(trip.title, trip.subtitle, trip.startDate, trip.endDate, trip.id))
  ipcMain.handle('steps:create', (_, tripId: string) => { const order = (db.prepare('SELECT COUNT(*) as count FROM steps WHERE trip_id=?').get(tripId) as { count: number }).count; const step: Step = { id: uuid(), tripId, title: '', body: '', placeName: '', occurredAt: '', sortOrder: order, photos: [] }; db.prepare('INSERT INTO steps VALUES (?, ?, ?, ?, ?, ?, ?)').run(step.id, tripId, '', '', '', '', order); return step })
  ipcMain.handle('steps:save', (_, step: Step) => db.prepare('UPDATE steps SET title=?, body=?, place_name=?, occurred_at=? WHERE id=?').run(step.title, step.body, step.placeName, step.occurredAt, step.id))
  ipcMain.handle('steps:delete', (_, stepId: string) => db.transaction(() => { db.prepare('DELETE FROM photos WHERE step_id=?').run(stepId); db.prepare('DELETE FROM steps WHERE id=?').run(stepId) })())
  ipcMain.handle('photos:import', async (_, stepId: string) => {
    const selected = await dialog.showOpenDialog(mainWindow, { title: 'Add photos', properties: ['openFile', 'multiSelections'], filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'heic'] }] })
    if (selected.canceled) return []
    const target = join(dataDirectory, stepId); await mkdir(target, { recursive: true })
    const start = (db.prepare('SELECT COUNT(*) as count FROM photos WHERE step_id=?').get(stepId) as { count: number }).count
    return Promise.all(selected.filePaths.map(async (source, index) => { const id = uuid(); const fileName = `${id}-${basename(source)}`; const filePath = join(target, fileName); await copyFile(source, filePath); db.prepare('INSERT INTO photos VALUES (?, ?, ?, ?, ?, ?)').run(id, stepId, fileName, filePath, '', start + index); return { id, stepId, fileName, path: photoUrl(filePath), caption: '', sortOrder: start + index } }))
  })
  ipcMain.handle('photos:save-caption', (_, photoId: string, caption: string) => db.prepare('UPDATE photos SET caption=? WHERE id=?').run(caption, photoId))
  ipcMain.handle('export:pdf', async (_, trip: Trip) => { const output = await dialog.showSaveDialog(mainWindow, { defaultPath: `${trip.title || 'icySteps-book'}.pdf`, filters: [{ name: 'PDF', extensions: ['pdf'] }] }); if (output.canceled || !output.filePath) return null; const window = new BrowserWindow({ show: false, webPreferences: { sandbox: true } }); await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(bookHtml(trip))}`); const pdf = await window.webContents.printToPDF({ preferCSSPageSize: true, printBackground: true }); await writeFile(output.filePath, pdf); window.destroy(); return output.filePath })
  ipcMain.handle('export:html', async (_, trip: Trip) => { const output = await dialog.showSaveDialog(mainWindow, { defaultPath: `${trip.title || 'icySteps-book'}.html`, filters: [{ name: 'HTML', extensions: ['html'] }] }); if (output.canceled || !output.filePath) return null; await writeFile(output.filePath, await portableBookHtml(trip)); return output.filePath })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
