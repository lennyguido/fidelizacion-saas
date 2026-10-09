import { expect, test } from '@playwright/test'

test('an archived customer can be found and reactivated', async ({ page }, testInfo) => {
  const suffix = `${Date.now()}-${testInfo.project.name}`
  await page.goto('/signup')
  await page.getByLabel('Email').fill(`archive-${suffix}@e2e.test`)
  await page.getByLabel('Contraseña').fill('clave-segura-123')
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  await page.getByLabel('Nombre del negocio').fill(`Kiosco ${suffix}`)
  await expect(page.getByText(/Disponible/)).toBeVisible()
  await page.getByRole('button', { name: 'Crear negocio' }).click()
  await expect(page).toHaveURL(/\/b\/kiosco-/)
  const base = new URL(page.url()).pathname.match(/^\/b\/[^/]+/)![0]

  await page.goto(`${base}/clientes/nuevo`)
  await page.getByLabel('Nombre').fill('Dora Archivada')
  await page.getByRole('button', { name: 'Guardar cliente' }).click()
  await expect(page.getByRole('heading', { name: 'Dora Archivada' })).toBeVisible()

  await page.getByRole('button', { name: 'Archivar' }).click()
  await expect(page).toHaveURL(new RegExp(`${base}/clientes$`))
  await expect(page.getByRole('link', { name: /Dora Archivada/ })).toHaveCount(0)

  await page.getByRole('button', { name: 'Archivados' }).click()
  await page.getByRole('link', { name: /Dora Archivada/ }).click()
  await page.getByRole('button', { name: 'Reactivar' }).click()
  await expect(page.getByText('volvió a la lista de clientes')).toBeVisible()

  await page.goto(`${base}/clientes`)
  await expect(page.getByRole('link', { name: /Dora Archivada/ })).toBeVisible()
})
