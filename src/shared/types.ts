export type Photo = {
  id: string
  stepId: string
  fileName: string
  path: string
  caption: string
  sortOrder: number
}

export type Step = {
  id: string
  tripId: string
  title: string
  body: string
  placeName: string
  occurredAt: string
  sortOrder: number
  photos: Photo[]
}

export type Trip = {
  id: string
  title: string
  subtitle: string
  startDate: string
  endDate: string
  createdAt: string
  steps: Step[]
}

export type StepInput = Omit<Step, 'id' | 'tripId' | 'sortOrder' | 'photos'>

export type IcyStepsApi = {
  appVersion: () => Promise<string>
  appPlatform: () => Promise<string>
  listTrips: () => Promise<Trip[]>
  createTrip: (title: string) => Promise<Trip>
  saveTrip: (trip: Pick<Trip, 'id' | 'title' | 'subtitle' | 'startDate' | 'endDate'>) => Promise<void>
  deleteTrip: (tripId: string) => Promise<boolean>
  createStep: (tripId: string) => Promise<Step>
  saveStep: (step: Step) => Promise<void>
  deleteStep: (stepId: string) => Promise<void>
  importPhotos: (stepId: string) => Promise<Photo[]>
  deletePhoto: (photoId: string) => Promise<void>
  savePhotoCaption: (photoId: string, caption: string) => Promise<void>
  exportPdf: (trip: Trip) => Promise<string | null>
  exportHtml: (trip: Trip) => Promise<string | null>
}
