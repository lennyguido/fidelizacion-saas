import { ComingSoon } from '../ComingSoon'
import type { ModuleManifest } from '../types'

export const loyaltyManifest: ModuleManifest = {
  id: 'loyalty',
  name: 'Fidelización',
  nav: [{ label: 'Fidelización', path: 'fidelizacion' }],
  routes: [
    {
      path: 'fidelizacion',
      element: (
        <ComingSoon
          title="Fidelización"
          description="Programa de puntos y sellos, recompensas y canjes con QR (Fase 4)."
        />
      ),
    },
  ],
}
