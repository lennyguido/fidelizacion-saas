// Apple Wallet: pass.json (tipo storeCard) y manifest.json. Funciones puras.
// Referencia: https://developer.apple.com/documentation/walletpasses/building-a-pass
import type { PassData } from '../lib/passData.ts'
import { brandColor, hexToRgb, rewardText, textColorOn, unitLabel } from '../lib/text.ts'
import { toHex } from '../lib/db.ts'

export interface ApplePassOptions {
  passTypeId: string
  teamId: string
  /** `${SUPABASE_URL}/functions/v1/wallet/apple` (Apple le agrega /v1/...). */
  webServiceUrl: string
  /** Token del pase (≥ 16 caracteres). En la base se guarda solo su hash. */
  authenticationToken: string
}

export function buildPassJson(data: PassData, options: ApplePassOptions) {
  const brand = brandColor(data.business.primaryColor)
  const text = hexToRgb(textColorOn(brand))
  const unit = unitLabel(data)
  return {
    formatVersion: 1,
    passTypeIdentifier: options.passTypeId,
    teamIdentifier: options.teamId,
    serialNumber: data.objectId,
    organizationName: data.business.name,
    description: `Tarjeta de ${data.business.name}`,
    logoText: data.business.name,
    backgroundColor: hexToRgb(brand),
    foregroundColor: text,
    labelColor: text,
    webServiceURL: options.webServiceUrl,
    authenticationToken: options.authenticationToken,
    sharingProhibited: true,
    ...(data.active ? {} : { voided: true }),
    barcodes: [
      {
        format: 'PKBarcodeFormatQR',
        message: data.memberCode,
        messageEncoding: 'iso-8859-1',
        altText: data.memberCode,
      },
    ],
    storeCard: {
      primaryFields: [
        {
          key: 'balance',
          label: unit.toUpperCase(),
          value: data.pointsBalance,
          changeMessage: `Ahora tenés %@ ${data.unit}`,
        },
      ],
      secondaryFields: data.firstName
        ? [{ key: 'member', label: 'SOCIO', value: data.firstName }]
        : [],
      auxiliaryFields: [{ key: 'next', label: 'PRÓXIMA RECOMPENSA', value: rewardText(data) }],
      backFields: [
        {
          key: 'how',
          label: 'Cómo se usa',
          value: 'Mostrá el código en la caja para sumar o canjear.',
        },
        { key: 'code', label: 'Código de socio', value: data.memberCode },
      ],
    },
  }
}

export type PassFiles = Record<string, Uint8Array>

export async function sha1Hex(bytes: Uint8Array): Promise<string> {
  return toHex(new Uint8Array(await crypto.subtle.digest('SHA-1', bytes)))
}

/** manifest.json: { "archivo": "sha1 en hex" } de cada archivo del pase. */
export async function buildManifest(files: PassFiles): Promise<Record<string, string>> {
  const manifest: Record<string, string> = {}
  for (const name of Object.keys(files).sort()) manifest[name] = await sha1Hex(files[name])
  return manifest
}

export function encodeJson(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value))
}
