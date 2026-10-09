import { readStorage, writeStorage } from '../../lib/storage'

const KEY = 'plataforma:last-business'

export const lastBusiness = {
  get: () => readStorage(KEY),
  set: (slug: string) => writeStorage(KEY, slug),
}
