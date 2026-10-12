import { expect, test } from '@playwright/test'

test('the owner sees last week summary on home and its page', async ({ page }, testInfo) => {
  const suffix = `${Date.now()}-${testInfo.project.name}`
  await page.goto('/signup')
  await page.getByLabel('Email').fill(`semana-${suffix}@e2e.test`)
  await page.getByLabel('Contraseña').fill('clave-segura-123')
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  await page.getByLabel('Nombre del negocio').fill(`Kiosco ${suffix}`)
  await expect(page.getByText(/Disponible/)).toBeVisible()
  await page.getByRole('button', { name: 'Crear negocio' }).click()
  await expect(page).toHaveURL(/\/b\//)

  await expect(page.getByRole('heading', { name: 'La semana pasada' })).toBeVisible()
  await page.getByRole('link', { name: 'Ver resumen' }).click()
  await expect(page.getByRole('heading', { name: 'Resumen de la semana' })).toBeVisible()
  await expect(page.getByText(/no se registraron visitas/).first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Mandármelo por WhatsApp' })).toHaveAttribute(
    'href',
    /^https:\/\/wa\.me\/\?text=Resumen/,
  )
})
