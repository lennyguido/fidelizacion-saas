import { expect, test } from '@playwright/test'

test('automatic recovery settings, birthday and a simulated cash register sale', async ({
  page,
}, testInfo) => {
  const suffix = `${Date.now()}-${testInfo.project.name}`
  await page.goto('/signup')
  await page.getByLabel('Email').fill(`auto-${suffix}@e2e.test`)
  await page.getByLabel('Contraseña').fill('clave-segura-123')
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  await page.getByLabel('Nombre del negocio').fill(`Kiosco ${suffix}`)
  await expect(page.getByText(/Disponible/)).toBeVisible()
  await page.getByRole('button', { name: 'Crear negocio' }).click()
  await expect(page).toHaveURL(/\/b\//)
  const base = new URL(page.url()).pathname.match(/^\/b\/[^/]+/)![0]

  // Inicio: tarjeta de la recuperación automática.
  await expect(page.getByText('No hay mensajes para mandar.')).toBeVisible()

  // Automático: prender "Clientes en riesgo" y revisar ahora.
  await page.goto(`${base}/recuperacion/automatico`)
  await expect(page.getByText('Así le llega a Ana:').first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Clientes en riesgo' })).toBeVisible()
  await page.getByRole('checkbox').first().check()
  await page.getByRole('button', { name: 'Guardar' }).first().click()
  await expect(page.getByText('Clientes en riesgo: encendida')).toBeVisible()
  await page.getByRole('button', { name: 'Revisar ahora' }).click()
  await expect(page.getByText('Hoy no hay mensajes nuevos')).toBeVisible()
  await page.goto(`${base}/recuperacion/mensajes`)
  await expect(page.getByText('No hay mensajes para mandar')).toBeVisible()

  // Cliente con cumpleaños.
  const phone = `11${String(Date.now()).slice(-8)}`
  await page.goto(`${base}/clientes/nuevo`)
  await page.getByLabel('Nombre').fill('Bea Cumple')
  await page.getByLabel('Teléfono (opcional)').fill(phone)
  await page.getByLabel('Día del cumpleaños').selectOption('3')
  await page.getByLabel('Mes del cumpleaños').selectOption('3')
  await page.getByRole('button', { name: 'Guardar cliente' }).click()
  await expect(page.getByText('Cumple el 3 de marzo')).toBeVisible()
  const customerUrl = page.url()

  // Caja: clave (se ve una vez) y venta de prueba con el celular del cliente.
  await page.goto(`${base}/negocio`)
  await page.getByRole('button', { name: 'Generar clave' }).click()
  await expect(page.getByText(/^lk_[0-9a-f]{40}$/)).toBeVisible()
  await page.getByLabel('Monto').fill('8500')
  await page.getByLabel('Celular del cliente (opcional)').fill(phone)
  await page.getByRole('button', { name: 'Mandar venta de prueba' }).click()
  await expect(page.getByText(/registrada para el cliente de ese celular/)).toBeVisible()

  await page.goto(customerUrl)
  await expect(page.getByText(/8\.500/).first()).toBeVisible()
})
