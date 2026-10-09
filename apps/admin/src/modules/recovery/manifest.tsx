import type { ModuleManifest } from '../types'
import { CampaignPage } from './CampaignPage'
import { NewCampaignPage } from './NewCampaignPage'
import { RecoveryPage } from './RecoveryPage'

export const recoveryManifest: ModuleManifest = {
  id: 'recovery',
  name: 'Recuperación',
  nav: [{ label: 'Recuperación', path: 'recuperacion' }],
  routes: [
    { path: 'recuperacion', element: <RecoveryPage /> },
    { path: 'recuperacion/campanas/nueva', element: <NewCampaignPage /> },
    { path: 'recuperacion/campanas/:campaignId', element: <CampaignPage /> },
  ],
}
