import type { KuroApi } from '../../electron/preload'

export {}

declare global {
  interface Window {
    // Derived from the preload bridge, so adding a method there is enough.
    kuro: KuroApi
  }
}
