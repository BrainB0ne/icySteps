import { contextBridge, ipcRenderer } from 'electron'
import type { IcyStepsApi } from '../shared/types'

const api: IcyStepsApi = {
  appVersion: () => ipcRenderer.invoke('app:version'),
  appPlatform: () => ipcRenderer.invoke('app:platform'),
  listTrips: () => ipcRenderer.invoke('trips:list'),
  createTrip: (title) => ipcRenderer.invoke('trips:create', title),
  saveTrip: (trip) => ipcRenderer.invoke('trips:save', trip),
  deleteTrip: (tripId) => ipcRenderer.invoke('trips:delete', tripId),
  createStep: (tripId) => ipcRenderer.invoke('steps:create', tripId),
  saveStep: (step) => ipcRenderer.invoke('steps:save', step),
  reorderSteps: (tripId, stepIds) => ipcRenderer.invoke('steps:reorder', tripId, stepIds),
  deleteStep: (stepId) => ipcRenderer.invoke('steps:delete', stepId),
  importPhotos: (stepId) => ipcRenderer.invoke('photos:import', stepId),
  reorderPhotos: (stepId, photoIds) => ipcRenderer.invoke('photos:reorder', stepId, photoIds),
  deletePhoto: (photoId) => ipcRenderer.invoke('photos:delete', photoId),
  savePhotoCaption: (photoId, caption) => ipcRenderer.invoke('photos:save-caption', photoId, caption),
  onExportProgress: (callback) => { const listener = (_: Electron.IpcRendererEvent, progress: Parameters<typeof callback>[0]) => callback(progress); ipcRenderer.on('export:progress', listener); return () => ipcRenderer.off('export:progress', listener) },
  exportPdf: (trip) => ipcRenderer.invoke('export:pdf', trip),
  exportHtml: (trip) => ipcRenderer.invoke('export:html', trip),
  exportZip: (trip) => ipcRenderer.invoke('export:zip', trip)
}

contextBridge.exposeInMainWorld('icySteps', api)
