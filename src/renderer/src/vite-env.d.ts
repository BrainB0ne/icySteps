/// <reference types="vite/client" />
import type { IcyStepsApi } from '../../shared/types'

declare global {
  interface Window {
    icySteps: IcyStepsApi
  }
}
