import { expect, test } from '@playwright/test'

test('points: set up, join, digital card, earn at the counter by code, redeem', async ({
  page,
  browser,
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

  // Cliente: se suma al programa y recibe su tarjeta digital.
  await page.goto(`${base}/clientes/nuevo`)
  await page.getByLabel('Nombre').fill('Lola Puntos')
  await page.getByRole('button', { name: 'Guardar cliente' }).click()
  await page.getByRole('button', { name: 'Sumar al programa' }).click()
  await expect(page.getByTestId('points-balance')).toHaveText('0')
  const customerUrl = page.url()

  await page.getByRole('button', { name: 'Crear tarjeta digital' }).click()
  const link = (await page.getByTestId('card-link').textContent())?.trim() ?? ''
  expect(link).toContain('/tarjeta#')

  // La tarjeta se abre sin iniciar sesión.
  const customerContext = await browser.newContext({ ...testInfo.project.use })
  const card = await customerContext.newPage()
  await card.goto(link)
  await expect(card.getByText('Hola, Lola')).toBeVisible()
  await expect(card.getByTestId('card-balance')).toHaveText('0')
  // Recompensa de 1 punto: la tarjeta se dibuja con sellos (1 casillero vacío).
  await expect(card.getByText(/Te falta/)).toBeVisible()
  await expect(card.getByRole('img', { name: '0 de 1 puntos' })).toBeVisible()
  const memberCode = (await card.getByTestId('member-code').textContent())?.trim() ?? ''
  expect(memberCode).toMatch(/^[A-Z2-9]{8}$/)

  // En el mostrador se encuentra por el código de la tarjeta.
  await page.goto(`${base}/mostrador`)
  await page.getByLabel('Buscar cliente').fill(memberCode.toLowerCase())
  await expect(page.getByText('Socio encontrado por código')).toBeVisible()
  await page.getByRole('button', { name: '+1', exact: true }).first().click()
  await expect(page.getByText('Visita de Lola Puntos registrada')).toBeVisible()

  await card.reload()
  await expect(card.getByTestId('card-balance')).toHaveText('1')
  await expect(card.getByText('¡Ya podés canjearla!')).toBeVisible()

  // Canje en la ficha del cliente.
  await page.goto(customerUrl)
  await expect(page.getByTestId('points-balance')).toHaveText('1')
  await page.getByRole('button', { name: 'Canjear' }).click()
  await expect(page.getByText(/Canje confirmado/)).toBeVisible()
  await expect(page.getByTestId('points-balance')).toHaveText('0')

  await card.reload()
  await expect(card.getByTestId('card-balance')).toHaveText('0')
  await customerContext.close()
})
