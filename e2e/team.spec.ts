import { expect, test } from '@playwright/test'

// El dueño invita a un empleado; el empleado crea su cuenta desde el link,
// acepta y entra al negocio sin acceso a lo que es solo del dueño.
test('owner invites a staff member who joins from the link', async ({
  page,
  browser,
}, testInfo) => {
  const suffix = `${Date.now()}-${testInfo.project.name}`
  const cashierEmail = `cajero-${suffix}@e2e.test`

  await page.goto('/signup')
  await page.getByLabel('Email').fill(`duena-${suffix}@e2e.test`)
  await page.getByLabel('Contraseña').fill('clave-segura-123')
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  await page.getByLabel('Nombre del negocio').fill(`Heladeria ${suffix}`)
  await expect(page.getByText(/Disponible/)).toBeVisible()
  await page.getByRole('button', { name: 'Crear negocio' }).click()
  await expect(page).toHaveURL(/\/b\/heladeria-/)

  await page.locator('nav:visible').getByRole('link', { name: 'Equipo' }).click()
  await page.getByLabel('Email de la persona').fill(cashierEmail)
  await page.getByRole('button', { name: 'Crear invitación' }).click()
  const link = (await page.getByTestId('invitation-link').textContent())?.trim() ?? ''
  expect(link).toContain('/invitacion/')
  await expect(page.getByText('Invitaciones pendientes')).toBeVisible()

  // El empleado abre el link en otro navegador.
  const cashierContext = await browser.newContext({ ...testInfo.project.use })
  const cashier = await cashierContext.newPage()
  await cashier.goto(link)
  await expect(cashier).toHaveURL(/\/login$/)
  await cashier.getByRole('link', { name: 'Crear cuenta' }).click()
  // Esperar a que cambie la página: login y registro tienen los mismos campos.
  await expect(cashier).toHaveURL(/\/signup$/)
  await cashier.getByLabel('Email').fill(cashierEmail)
  await cashier.getByLabel('Contraseña').fill('clave-segura-123')
  await cashier.getByRole('button', { name: 'Crear cuenta' }).click()

  await expect(cashier.getByText(/Te invitaron a/)).toBeVisible()
  await expect(cashier.getByText('Empleado', { exact: true })).toBeVisible()
  await cashier.getByRole('button', { name: 'Aceptar y entrar' }).click()
  await expect(cashier).toHaveURL(/\/b\/heladeria-/)
  await expect(
    cashier.locator('nav:visible').getByRole('link', { name: 'Mostrador' }),
  ).toBeVisible()
  await expect(cashier.locator('nav:visible').getByRole('link', { name: 'Equipo' })).toHaveCount(0)
  await cashierContext.close()

  // El dueño ve al empleado en el equipo.
  await page.reload()
  await expect(page.getByText(cashierEmail)).toBeVisible()
})
