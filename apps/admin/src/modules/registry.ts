import { loyaltyManifest } from './loyalty/manifest'
import { recoveryManifest } from './recovery/manifest'
import type { ModuleManifest } from './types'

/** Todos los módulos que conoce el panel. Agregar acá cada módulo nuevo. */
export const moduleManifests: ModuleManifest[] = [loyaltyManifest, recoveryManifest]
