import { loyalty } from '@plataforma/sdk'
import type { ModuleManifest } from '../types'
import { CustomerLoyaltyPanel } from './CustomerLoyaltyPanel'
import { LoyaltyPage } from './LoyaltyPage'

export const loyaltyManifest: ModuleManifest = {
  id: 'loyalty',
  name: 'Fidelización',
  nav: [{ label: 'Fidelización', path: 'fidelizacion' }],
  routes: [{ path: 'fidelizacion', element: <LoyaltyPage /> }],
  customerPanel: CustomerLoyaltyPanel,
  customerCodeLookup: {
    matches: loyalty.looksLikeMemberCode,
    find: loyalty.findCustomerByMemberCode,
  },
}
