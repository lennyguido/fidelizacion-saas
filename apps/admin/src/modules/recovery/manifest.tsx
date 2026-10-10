import type { ModuleManifest } from '../types'
import { AutomationsPage } from './AutomationsPage'
import { CampaignPage } from './CampaignPage'
import { CouponCounterPanel } from './CouponCounterPanel'
import { NewCampaignPage } from './NewCampaignPage'
import { OutboxPage } from './OutboxPage'
import { ReadyMessagesHomeCard } from './ReadyMessagesHomeCard'
import { RecoveryPage } from './RecoveryPage'

export const recoveryManifest: ModuleManifest = {
  id: 'recovery',
  name: 'Recuperación',
  nav: [{ label: 'Recuperación', path: 'recuperacion' }],
  routes: [
    { path: 'recuperacion', element: <RecoveryPage /> },
    { path: 'recuperacion/automatico', element: <AutomationsPage /> },
    { path: 'recuperacion/mensajes', element: <OutboxPage /> },
    { path: 'recuperacion/campanas/nueva', element: <NewCampaignPage /> },
    { path: 'recuperacion/campanas/:campaignId', element: <CampaignPage /> },
  ],
  homeCard: ReadyMessagesHomeCard,
  counterPanel: CouponCounterPanel,
}
