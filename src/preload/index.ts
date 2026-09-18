import { contextBridge, ipcRenderer } from 'electron'
import type { IcyStepsApi } from '../shared/types'

const api: IcyStepsApi = {
  appVersion: () => ipcRenderer.invoke('app:version'),
  listTrips: () => ipcRenderer.invoke('trips:list'),
  createTrip: (title) => ipcRenderer.invoke('trips:create', title),
  saveTrip: (trip) => ipcRenderer.invoke('trips:save', trip),
  deleteTrip: (tripId) => ipcRenderer.invoke('trips:delete', tripId),
  createStep: (tripId) => ipcRenderer.invoke('steps:create', tripId),
  saveStep: (step) => ipcRenderer.invoke('steps:save', step),
  deleteStep: (stepId) => ipcRenderer.invoke('steps:delete', stepId),
  importPhotos: (stepId) => ipcRenderer.invoke('photos:import', stepId),
  deletePhoto: (photoId) => ipcRenderer.invoke('photos:delete', photoId),
  savePhotoCaption: (photoId, caption) => ipcRenderer.invoke('photos:save-caption', photoId, caption),
  exportPdf: (trip) => ipcRenderer.invoke('export:pdf', trip),
  exportHtml: (trip) => ipcRenderer.invoke('export:html', trip)
}

contextBridge.exposeInMainWorld('icySteps', api)
