import { expect, test } from '@playwright/test'

// Tarjeta de sellos: el cliente ve casilleros que se llenan con el logo (o un tilde).
test('stamps: the card shows filled stamps toward the reward', async ({
  page,
  browser,
}, testInfo) => {
  const suffix = `${Date.now()}-${testInfo.project.name}`
  await page.goto('/signup')
  await page.getByLabel('Email').fill(`sellos-${suffix}@e2e.test`)
  await page.getByLabel('Contraseña').fill('clave-segura-123')
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  await page.getByLabel('Nombre del negocio').fill(`Sellos ${suffix}`)
  await expect(page.getByText(/Disponible/)).toBeVisible()
  await page.getByRole('button', { name: 'Crear negocio' }).click()
  await expect(page).toHaveURL(/\/b\/sellos-/)
  const base = new URL(page.url()).pathname.match(/^\/b\/[^/]+/)![0]

  // Programa "Tarjeta de sellos" con una recompensa de 3 sellos.
  await page.goto(`${base}/fidelizacion`)
  await page.getByLabel('Tarjeta de sellos').check()
  await page.getByRole('button', { name: 'Guardar programa' }).click()
  await expect(page.getByText('1 sello por visita')).toBeVisible()
  await page.getByLabel('Nueva recompensa').fill('Café de regalo')
  await page.getByLabel('Cuesta (puntos)').fill('3')
  await page.getByRole('button', { name: 'Agregar recompensa' }).click()
  await expect(page.getByText('Café de regalo')).toBeVisible()

  // Cliente con su tarjeta digital.
  await page.goto(`${base}/clientes/nuevo`)
  await page.getByLabel('Nombre').fill('Tina Sellos')
  await page.getByRole('button', { name: 'Guardar cliente' }).click()
  await page.getByRole('button', { name: 'Sumar al programa' }).click()
  await expect(page.getByTestId('points-balance')).toHaveText('0')
  await page.getByRole('button', { name: 'Crear tarjeta digital' }).click()
  const link = (await page.getByTestId('card-link').textContent())?.trim() ?? ''
  expect(link).toContain('/tarjeta#')

  const customerContext = await browser.newContext({ ...testInfo.project.use })
  const card = await customerContext.newPage()
  await card.goto(link)
  await expect(card.getByRole('img', { name: '0 de 3 sellos' })).toBeVisible()
  await expect(card.getByTestId('stamp-empty')).toHaveCount(3)

  // Dos visitas seguidas no suman (tope anti-trampa), así que se usa el ajuste manual.
  await page.getByText('Ajustar puntos a mano').click()
  await page.getByLabel('Puntos (+ o -)').fill('2')
  await page.getByLabel('Motivo').fill('prueba de sellos')
  await page.getByRole('button', { name: 'Ajustar', exact: true }).click()
  await expect(page.getByTestId('points-balance')).toHaveText('2')

  await card.reload()
  await expect(card.getByRole('img', { name: '2 de 3 sellos' })).toBeVisible()
  await expect(card.getByTestId('stamp-filled')).toHaveCount(2)
  await expect(card.getByTestId('stamp-empty')).toHaveCount(1)
  await expect(card.getByText('Te falta 1 sello para')).toBeVisible()
  await expect(card.getByTestId('rewards-ready')).toHaveText('Recompensas listas: 0')
  await expect(card.getByTestId('member-code')).toBeVisible()
  await customerContext.close()
})
