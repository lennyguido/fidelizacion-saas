import { expect, test } from '@playwright/test'

// Recorrido completo del dueño de un negocio nuevo:
// registro → onboarding → panel → salir → volver a ingresar.
test('a new owner signs up, creates a business and gets back in', async ({ page }, testInfo) => {
  const suffix = `${Date.now()}-${testInfo.project.name}`
  const email = `owner-${suffix}@e2e.test`
  const password = 'clave-segura-123'
  const businessName = `Café E2E ${suffix}`

  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)

  await page.getByRole('link', { name: 'Crear cuenta' }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Crear cuenta' }).click()

  await expect(page).toHaveURL(/\/onboarding$/)
  await page.getByLabel('Nombre del negocio').fill(businessName)
  await expect(page.getByText(/Disponible/)).toBeVisible()
  await page.getByRole('button', { name: 'Crear negocio' }).click()

  await expect(page).toHaveURL(/\/b\/cafe-e2e-/)
  await expect(page.getByRole('heading', { name: businessName })).toBeVisible()
  await expect(page.getByText('Dueño')).toBeVisible()
  await expect(page.getByText('Tus clientes')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Fidelización' }).first()).toBeVisible()

  // Un negocio ajeno (seed DEMO) no es accesible por URL.
  await page.goto('/b/cafe-central')
  await expect(page.getByText('No encontramos ese negocio')).toBeVisible()

  // Salir y volver a entrar lleva al último negocio usado.
  await page.goto('/')
  await expect(page).toHaveURL(/\/b\/cafe-e2e-/)
  await page.getByRole('button', { name: 'Salir' }).first().click()
  await expect(page).toHaveURL(/\/login$/)

  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(/\/b\/cafe-e2e-/)
})

test('wrong credentials show a clear error', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill('nadie@e2e.test')
  await page.getByLabel('Contraseña').fill('incorrecta-123')
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page.getByRole('alert')).toContainText('Email o contraseña incorrectos')
})
