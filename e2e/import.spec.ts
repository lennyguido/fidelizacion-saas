import { expect, test } from '@playwright/test'

test('the owner imports customers from a CSV file', async ({ page }, testInfo) => {
  const suffix = `${Date.now()}-${testInfo.project.name}`
  await page.goto('/signup')
  await page.getByLabel('Email').fill(`import-${suffix}@e2e.test`)
  await page.getByLabel('Contraseña').fill('clave-segura-123')
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  await page.getByLabel('Nombre del negocio').fill(`Almacen ${suffix}`)
  await expect(page.getByText(/Disponible/)).toBeVisible()
  await page.getByRole('button', { name: 'Crear negocio' }).click()
  await expect(page).toHaveURL(/\/b\/almacen-/)

  await page.goto(page.url() + '/clientes/importar')
  const csv = [
    'Nombre;Apellido;Teléfono;Correo',
    'Ana;Gómez;11 2233-4455;ana@mail.com',
    'Bruno;Díaz;011 15 6677-8899;',
    ';;11 1111-1111;',
    'Carla;Ruiz;123;',
  ].join('\r\n')
  await page.locator('input[type=file]').setInputFiles({
    name: 'clientes.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('﻿' + csv, 'utf8'),
  })

  await expect(page.getByText('2 listos para importar · 2 con problemas')).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Ana Gómez' })).toBeVisible()
  await page.getByRole('button', { name: 'Importar 2 clientes' }).click()
  await expect(page.getByText(/Se importaron\s*2\s*clientes/)).toBeVisible()

  await page.goto(page.url().replace('/clientes/importar', '/clientes'))
  await expect(page.getByRole('link', { name: /Ana Gómez/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Bruno Díaz/ })).toBeVisible()
})
