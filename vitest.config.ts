import { defineConfig } from 'vitest/config'

// Tests unitarios (lógica pura: formatos, validaciones). Los de base de datos son
// pgTAP (supabase/tests) y los de punta a punta Playwright (e2e/).
export default defineConfig({
  test: {
    include: ['packages/**/*.test.ts', 'apps/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
})
