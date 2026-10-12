import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

test('the owner downloads her customers and visits as CSV', async ({ page }, testInfo) => {
  const suffix = `${Date.now()}-${testInfo.project.name}`
  await page.goto('/signup')
  await page.getByLabel('Email').fill(`export-${suffix}@e2e.test`)
  await page.getByLabel('Contraseña').fill('clave-segura-123')
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  await page.getByLabel('Nombre del negocio').fill(`Kiosco ${suffix}`)
  await expect(page.getByText(/Disponible/)).toBeVisible()
  await page.getByRole('button', { name: 'Crear negocio' }).click()
  await expect(page).toHaveURL(/\/b\//)
  const base = new URL(page.url()).pathname.match(/^\/b\/[^/]+/)![0]

  await page.goto(`${base}/clientes/nuevo`)
  await page.getByLabel('Nombre').fill('Carla Export')
  await page.getByRole('button', { name: 'Guardar cliente' }).click()
  await expect(page.getByRole('heading', { name: 'Carla Export' })).toBeVisible()

  await page.goto(`${base}/negocio`)
  await expect(page.getByRole('heading', { name: 'Tus clientes son tuyos' })).toBeVisible()

  const [customers] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Descargar todos los clientes' }).click(),
  ])
  expect(customers.suggestedFilename()).toMatch(/^clientes-\d{4}-\d{2}-\d{2}\.csv$/)
  const content = await readFile((await customers.path())!, 'utf8')
  expect(content).toContain('Nombre;Teléfono')
  expect(content).toContain('Carla Export')

  const [visits] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Descargar visitas/ }).click(),
  ])
  expect(visits.suggestedFilename()).toMatch(/^visitas-.*\.csv$/)
})
