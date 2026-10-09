import { expect, test } from '@playwright/test'

test('owner: dashboard, WhatsApp consent and a recovery campaign draft', async ({
  page,
}, testInfo) => {
  const suffix = `${Date.now()}-${testInfo.project.name}`
  await page.goto('/signup')
  await page.getByLabel('Email').fill(`recupero-${suffix}@e2e.test`)
  await page.getByLabel('Contraseña').fill('clave-segura-123')
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  await page.getByLabel('Nombre del negocio').fill(`Bar ${suffix}`)
  await expect(page.getByText(/Disponible/)).toBeVisible()
  await page.getByRole('button', { name: 'Crear negocio' }).click()
  await expect(page).toHaveURL(/\/b\/bar-/)
  const base = new URL(page.url()).pathname.match(/^\/b\/[^/]+/)![0]

  // Tablero del mes (solo dueño/admin).
  await expect(page.getByRole('heading', { name: 'Este mes' })).toBeVisible()
  await expect(page.getByText('Visitas del mes')).toBeVisible()

  // Consentimiento de WhatsApp en la ficha.
  await page.goto(`${base}/clientes/nuevo`)
  await page.getByLabel('Nombre').fill('Tomás Consiente')
  await page.getByLabel('Teléfono (opcional)').fill('11 2233-4455')
  await page.getByRole('button', { name: 'Guardar cliente' }).click()
  await expect(page.getByTestId('whatsapp-consent')).toContainText('Todavía no le preguntaste')
  await page.getByRole('button', { name: 'Acepta WhatsApp' }).click()
  await expect(page.getByTestId('whatsapp-consent')).toContainText('Acepta mensajes')

  // Campaña: el cliente nuevo no está en riesgo, así que el grupo queda vacío.
  await page.goto(`${base}/recuperacion`)
  await expect(page.getByRole('heading', { name: 'Recuperación' })).toBeVisible()
  await page.getByRole('link', { name: 'Nueva campaña' }).click()
  await expect(page.getByTestId('segment-preview')).toContainText('0 clientes entran')
  await expect(page.getByText(/Así le llega a Ana/)).toBeVisible()
  await page.getByRole('button', { name: 'Guardar y revisar' }).click()
  await expect(page.getByRole('heading', { name: 'Te extrañamos' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Lanzar campaña' })).toBeDisabled()
  await expect(page.getByText(/Nadie de este grupo aceptó WhatsApp/)).toBeVisible()
  await page.getByRole('button', { name: 'Cancelar' }).click()
  await expect(page.getByText('Cancelada')).toBeVisible()
})
