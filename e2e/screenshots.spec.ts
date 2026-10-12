import { expect, test, type Page } from '@playwright/test'

// Capturas de las pantallas principales (estilo Apple, D-039). En CI se suben como
// el artefacto "capturas" para revisar el diseño en celular y en computadora.
async function shot(page: Page, name: string, project: string) {
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: `test-results/capturas/${project}-${name}.png`, fullPage: true })
}

test('screenshots of the main screens', async ({ page, browser }, testInfo) => {
  const project = testInfo.project.name
  const suffix = `${Date.now()}-${project}`
  await page.goto('/signup')
  await shot(page, '01-registro', project)
  await page.getByLabel('Email').fill(`capturas-${suffix}@e2e.test`)
  await page.getByLabel('Contraseña').fill('clave-segura-123')
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  await page.getByLabel('Nombre del negocio').fill(`Cafe ${suffix}`)
  await expect(page.getByText(/Disponible/)).toBeVisible()
  await page.getByRole('button', { name: 'Crear negocio' }).click()
  await expect(page).toHaveURL(/\/b\/cafe-/)
  const base = new URL(page.url()).pathname.match(/^\/b\/[^/]+/)![0]
  await shot(page, '02-inicio', project)

  await page.goto(`${base}/fidelizacion`)
  await page.getByRole('button', { name: 'Guardar programa' }).click()
  await expect(page.getByText('1 punto por visita')).toBeVisible()
  await page.getByLabel('Nueva recompensa').fill('Café gratis')
  await page.getByLabel('Cuesta (puntos)').fill('1')
  await page.getByRole('button', { name: 'Agregar recompensa' }).click()
  await expect(page.getByText('Café gratis')).toBeVisible()
  await shot(page, '03-fidelizacion', project)

  await page.goto(`${base}/clientes/nuevo`)
  await page.getByLabel('Nombre').fill('Lola Captura')
  await page.getByRole('button', { name: 'Guardar cliente' }).click()
  await page.getByRole('button', { name: 'Sumar al programa' }).click()
  await expect(page.getByTestId('points-balance')).toHaveText('0')
  await page.getByRole('button', { name: 'Crear tarjeta digital' }).click()
  const link = (await page.getByTestId('card-link').textContent())?.trim() ?? ''
  await shot(page, '04-ficha-cliente', project)

  await page.goto(`${base}/mostrador`)
  await page.getByLabel('Buscar cliente').fill('Lola')
  await expect(page.getByText('Lola Captura')).toBeVisible()
  await shot(page, '05-mostrador', project)

  await page.goto(`${base}/negocio`)
  await shot(page, '06-mi-negocio', project)
  await page.goto(`${base}/semana`)
  await shot(page, '07-resumen-semana', project)

  const customerContext = await browser.newContext({ ...testInfo.project.use })
  const card = await customerContext.newPage()
  await card.goto(link)
  await expect(card.getByText('Hola, Lola')).toBeVisible()
  await shot(card, '08-tarjeta-cliente', project)
  await customerContext.close()
})
