import { ComingSoon } from '../ComingSoon'
import type { ModuleManifest } from '../types'

export const recoveryManifest: ModuleManifest = {
  id: 'recovery',
  name: 'Recuperación',
  nav: [{ label: 'Recuperación', path: 'recuperacion' }],
  routes: [
    {
      path: 'recuperacion',
      element: (
        <ComingSoon
          title="Recuperación"
          description="Clientes en riesgo, campañas y dinero recuperado (Fase 5)."
        />
      ),
    },
  ],
}
