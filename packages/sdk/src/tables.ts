import type { Database } from './database.types.ts'

type Core = Database['core']

/** Fila de una tabla o vista del esquema `core` (tipos generados). */
export type Tables<T extends keyof Core['Tables'] | keyof Core['Views']> =
  T extends keyof Core['Tables']
    ? Core['Tables'][T]['Row']
    : T extends keyof Core['Views']
      ? Core['Views'][T]['Row']
      : never

/** Resultado de una función del esquema `core`. */
export type FunctionReturns<F extends keyof Core['Functions']> = Core['Functions'][F]['Returns']
