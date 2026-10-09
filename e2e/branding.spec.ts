import { expect, test } from '@playwright/test'

// PNG de 1×1 píxel, para probar la subida del logo.
const PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

// White-label: el dueño cambia nombre, color y logo, y la tarjeta del cliente los usa.
test('the owner edits the business branding and the card uses it', async ({
  page,
  browser,
}, testInfo) => {
  const suffix = `${Date.now()}-${testInfo.project.name}`
  const newName = `Heladería ${suffix}`
  await page.goto('/signup')
  await page.getByLabel('Email').fill(`marca-${suffix}@e2e.test`)
  await page.getByLabel('Contraseña').fill('clave-segura-123')
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  await page.getByLabel('Nombre del negocio').fill(`Marca ${suffix}`)
  await expect(page.getByText(/Disponible/)).toBeVisible()
  await page.getByRole('button', { name: 'Crear negocio' }).click()
  await expect(page).toHaveURL(/\/b\/marca-/)
  const base = new URL(page.url()).pathname.match(/^\/b\/[^/]+/)![0]

  // Mi negocio: nombre y color.
  await page.locator('nav:visible').getByRole('link', { name: 'Mi negocio' }).click()
  await expect(page.getByRole('heading', { name: 'Mi negocio' })).toBeVisible()
  await page.getByLabel('Nombre del negocio').fill(newName)
  await page.getByLabel('Color de marca (hex)').fill('#zzzzzz')
  await expect(page.getByText('Usá el formato #RRGGBB')).toBeVisible()
  await page.getByLabel('Color de marca (hex)').fill('#b91c1c')
  await page.getByLabel('Zona horaria').selectOption('America/Montevideo')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByText('Datos del negocio guardados')).toBeVisible()
  await expect(page.getByText(newName, { exact: true }).filter({ visible: true })).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`${base}/negocio$`)) // el slug no cambia

  // Logo.
  await page.getByLabel('Archivo del logo').setInputFiles({
    name: 'logo.png',
    mimeType: 'image/png',
    buffer: PIXEL_PNG,
  })
  await expect(page.getByText('Logo actualizado')).toBeVisible()
  await expect(page.getByRole('img', { name: `Logo de ${newName}` })).toBeVisible()

  // La tarjeta del cliente usa nombre, color y logo del negocio.
  await page.goto(`${base}/fidelizacion`)
  await page.getByRole('button', { name: 'Guardar programa' }).click()
  await expect(page.getByText('1 punto por visita')).toBeVisible()
  await page.goto(`${base}/clientes/nuevo`)
  await page.getByLabel('Nombre').fill('Lola Marca')
  await page.getByRole('button', { name: 'Guardar cliente' }).click()
  await page.getByRole('button', { name: 'Sumar al programa' }).click()
  await page.getByRole('button', { name: 'Crear tarjeta digital' }).click()
  const link = (await page.getByTestId('card-link').textContent())?.trim() ?? ''

  const customerContext = await browser.newContext({ ...testInfo.project.use })
  const card = await customerContext.newPage()
  await card.goto(link)
  await expect(card.getByText('Hola, Lola')).toBeVisible()
  await expect(card).toHaveTitle(`${newName} · Mi tarjeta`)
  await expect(card.getByTestId('card-business')).toHaveText(newName)
  await expect(card.locator('header')).toHaveCSS('background-color', 'rgb(185, 28, 28)')
  await expect(card.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#b91c1c')
  const logo = card.getByRole('img', { name: `Logo de ${newName}` })
  await expect(logo).toHaveAttribute('src', /\/storage\/v1\/object\/public\/logos\//)
  await expect
    .poll(() => logo.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0)
  await customerContext.close()
})
