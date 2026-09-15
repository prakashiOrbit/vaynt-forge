/// <reference types="vite/client" />

import type { VayntForgeApi } from '../../shared/types'

declare global {
  interface Window {
    vayntforge: VayntForgeApi
  }
}

export {}