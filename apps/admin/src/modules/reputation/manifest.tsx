import type { ModuleManifest } from '../types'
import { ReviewTagsHomeCard } from './ReviewTagsHomeCard'
import { ReviewTagsPage } from './ReviewTagsPage'

export const reputationManifest: ModuleManifest = {
  id: 'reputation',
  name: 'Reseñas',
  nav: [{ label: 'Reseñas', path: 'resenas' }],
  routes: [{ path: 'resenas', element: <ReviewTagsPage /> }],
  homeCard: ReviewTagsHomeCard,
}
