import { expect, test } from '@playwright/test'

test('the owner sets up points, a customer joins, earns and redeems', async ({
  page,
}, testInfo) => {
  const suffix = `${Date.now()}-${testInfo.project.name}`
  await page.goto('/signup')
  await page.getByLabel('Email').fill(`puntos-${suffix}@e2e.test`)
  await page.getByLabel('Contraseña').fill('clave-segura-123')
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  await page.getByLabel('Nombre del negocio').fill(`Cafe ${suffix}`)
  await expect(page.getByText(/Disponible/)).toBeVisible()
  await page.getByRole('button', { name: 'Crear negocio' }).click()
  await expect(page).toHaveURL(/\/b\/cafe-/)
  const base = new URL(page.url()).pathname.match(/^\/b\/[^/]+/)![0]

  // Programa: 1 punto por visita (valor por defecto) y una recompensa de 1 punto.
  await page.goto(`${base}/fidelizacion`)
  await page.getByRole('button', { name: 'Guardar programa' }).click()
  await expect(page.getByText('1 punto por visita')).toBeVisible()
  await page.getByLabel('Nueva recompensa').fill('Café gratis')
  await page.getByLabel('Cuesta (puntos)').fill('1')
  await page.getByRole('button', { name: 'Agregar recompensa' }).click()
  await expect(page.getByText('Café gratis')).toBeVisible()

  // Cliente: se suma, viene una vez y canjea.
  await page.goto(`${base}/clientes/nuevo`)
  await page.getByLabel('Nombre').fill('Lola Puntos')
  await page.getByRole('button', { name: 'Guardar cliente' }).click()
  await page.getByRole('button', { name: 'Sumar al programa' }).click()
  await expect(page.getByTestId('points-balance')).toHaveText('0')

  await page.getByRole('button', { name: '+ Registrar visita' }).click()
  await expect(page.getByTestId('points-balance')).toHaveText('1')

  await page.getByRole('button', { name: 'Canjear' }).click()
  await expect(page.getByText(/Canje confirmado/)).toBeVisible()
  await expect(page.getByTestId('points-balance')).toHaveText('0')
})
