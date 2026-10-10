import { expect, test, type Page } from '@playwright/test'

async function createBusiness(page: Page, suffix: string, name: string): Promise<string> {
  await page.goto('/signup')
  await page.getByLabel('Email').fill(`alta-${suffix}@e2e.test`)
  await page.getByLabel('Contraseña').fill('clave-segura-123')
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  await page.getByLabel('Nombre del negocio').fill(name)
  await expect(page.getByText(/Disponible/)).toBeVisible()
  await page.getByRole('button', { name: 'Crear negocio' }).click()
  await expect(page).toHaveURL(/\/b\//)
  return new URL(page.url()).pathname.match(/^\/b\/[^/]+/)![0]
}

test('template, QR sign-up poster, customer signs up alone and repeated sign-ups notify', async ({
  page,
  browser,
}, testInfo) => {
  const suffix = `${Date.now()}-${testInfo.project.name}`
  const base = await createBusiness(page, suffix, `Cafe Alta ${suffix}`)

  // Plantilla de cafetería: regla + 2 recompensas.
  await page.goto(`${base}/fidelizacion`)
  await page
    .getByRole('listitem')
    .filter({ hasText: 'Cafetería' })
    .getByRole('button', { name: 'Usar' })
    .click()
  await expect(page.getByText('Listo: programa de Cafetería')).toBeVisible()
  await expect(page.getByText('Café de regalo').first()).toBeVisible()

  // Alta por QR: activar y ver el cartel.
  await page.getByRole('button', { name: 'Activar', exact: true }).click()
  const link = page.getByText(/\/alta\/[A-Z2-9]{10}$/)
  await expect(link).toBeVisible()
  const signupUrl = ((await link.textContent()) ?? '').trim()
  await page.getByRole('link', { name: 'Imprimir cartel' }).click()
  await expect(page.getByText('Sumate al club: tu 9.º café es gratis')).toBeVisible()
  await expect(page.getByRole('img', { name: 'Código QR para anotarse' })).toBeVisible()

  // El cliente escanea el cartel y se anota solo.
  const phone = `11${String(Date.now()).slice(-8)}`
  const customer = await browser.newContext({ ...testInfo.project.use })
  const signup = await customer.newPage()
  await signup.goto(signupUrl)
  await expect(signup.getByRole('heading', { name: 'Sumate al club' })).toBeVisible()
  await signup.getByLabel('Tu nombre').fill('Nico Alta')
  await signup.getByLabel('Tu celular').fill(phone)
  await expect(signup.getByRole('button', { name: 'Quiero mi tarjeta' })).toBeDisabled()
  await signup.getByLabel(/Acepto que el negocio guarde/).check()
  await signup.getByRole('button', { name: 'Quiero mi tarjeta' }).click()
  await expect(signup.getByText('Hola, Nico')).toBeVisible()
  await expect(signup.getByTestId('card-balance')).toHaveText('0')
  await customer.close()

  // Otra persona con el mismo celular: no ve la tarjeta y el local recibe un aviso.
  const again = await browser.newContext({ ...testInfo.project.use })
  const repeat = await again.newPage()
  await repeat.goto(signupUrl)
  await repeat.getByLabel('Tu nombre').fill('Otro Nombre')
  await repeat.getByLabel('Tu celular').fill(phone)
  await repeat.getByLabel(/Acepto que el negocio guarde/).check()
  await repeat.getByRole('button', { name: 'Quiero mi tarjeta' }).click()
  await expect(repeat.getByText(/Recibimos tus datos/)).toBeVisible()
  await expect(repeat.getByText('Hola,')).toHaveCount(0)
  await again.close()

  await page.goto(`${base}/fidelizacion`)
  await expect(page.getByText('Avisos del alta (1)')).toBeVisible()
  await expect(page.getByText('Escribió “Otro Nombre”', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Listo', exact: true }).click()
  await expect(page.getByText('Avisos del alta (1)')).toHaveCount(0)
})
