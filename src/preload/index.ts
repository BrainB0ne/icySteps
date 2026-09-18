import { contextBridge, ipcRenderer } from 'electron'
import type { IcyStepsApi } from '../shared/types'

const api: IcyStepsApi = {
  listTrips: () => ipcRenderer.invoke('trips:list'),
  createTrip: (title) => ipcRenderer.invoke('trips:create', title),
  saveTrip: (trip) => ipcRenderer.invoke('trips:save', trip),
  createStep: (tripId) => ipcRenderer.invoke('steps:create', tripId),
  saveStep: (step) => ipcRenderer.invoke('steps:save', step),
  deleteStep: (stepId) => ipcRenderer.invoke('steps:delete', stepId),
  importPhotos: (stepId) => ipcRenderer.invoke('photos:import', stepId),
  exportPdf: (trip) => ipcRenderer.invoke('export:pdf', trip),
  exportHtml: (trip) => ipcRenderer.invoke('export:html', trip)
}

contextBridge.exposeInMainWorld('icySteps', api)
