/// <reference types="vite/client" />

import type { ApiForgeApi } from '../../shared/types'

declare global {
  interface Window {
    apiforge: ApiForgeApi
  }
}

export {}