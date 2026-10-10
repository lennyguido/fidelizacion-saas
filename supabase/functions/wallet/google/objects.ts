// Google Wallet: LoyaltyClass (uno por negocio) y LoyaltyObject (uno por socio).
// Funciones puras: arman el JSON que se manda a la API REST y al JWT de "Guardar".
// Referencia: https://developers.google.com/wallet/retail/loyalty-cards/rest/v1/loyaltyclass
import type { PassData } from '../lib/passData.ts'
import { stampImageUrl } from '../lib/stamps.ts'
import { brandColor, rewardText, unitLabel } from '../lib/text.ts'

export const GOOGLE_SAVE_URL = 'https://pay.google.com/gp/v/save/'
export const WALLET_SCOPE = 'https://www.googleapis.com/auth/wallet_object.issuer'
const LANGUAGE = 'es-419'

/** "<issuer>.biz_<uuid sin guiones>": solo letras, números, ".", "_" y "-". */
export function classIdFor(issuerId: string, businessId: string): string {
  return `${issuerId}.biz_${businessId.replace(/[^0-9a-zA-Z]/g, '')}`
}

export function objectIdFor(issuerId: string, objectId: string): string {
  return `${issuerId}.${objectId.replace(/[^0-9a-zA-Z_-]/g, '')}`
}

function localized(value: string) {
  return { defaultValue: { language: LANGUAGE, value } }
}

export function buildLoyaltyClass(issuerId: string, data: PassData, logoUrl: string) {
  const name = data.business.name
  return {
    id: classIdFor(issuerId, data.businessId),
    issuerName: name,
    programName: name,
    programLogo: {
      sourceUri: { uri: logoUrl },
      contentDescription: localized(`Logo de ${name}`),
    },
    hexBackgroundColor: brandColor(data.business.primaryColor),
    reviewStatus: 'UNDER_REVIEW',
    multipleDevicesAndHoldersAllowedStatus: 'ONE_USER_ALL_DEVICES',
  }
}

/**
 * Imagen de la fila de sellos (heroImage del objeto). La URL cambia con los sellos y
 * la marca, así Google baja la nueva en cada sync. null si el pase no es de sellos.
 */
export function stampHeroImage(data: PassData, stampBase: string | null | undefined) {
  const uri = stampBase ? stampImageUrl(stampBase, data) : null
  if (!uri) return null
  return { sourceUri: { uri }, contentDescription: localized(stampDescription(data)) }
}

function stampDescription(data: PassData): string {
  const goal = data.stampGoal ?? 0
  const progress = Math.min(Math.max(0, Math.trunc(data.pointsBalance)), goal)
  return `${progress} de ${goal} ${data.unit}`
}

/** Campos del objeto que cambian con el saldo (se usan también en el PATCH del sync). */
export function loyaltyObjectFields(data: PassData, stampBase?: string | null) {
  const heroImage = stampHeroImage(data, stampBase)
  return {
    state: data.active ? 'ACTIVE' : 'INACTIVE',
    accountId: data.memberCode,
    accountName: data.firstName ?? '',
    loyaltyPoints: {
      label: unitLabel(data),
      balance: { int: Math.max(0, Math.min(Math.trunc(data.pointsBalance), 2_147_483_647)) },
    },
    barcode: { type: 'QR_CODE', value: data.memberCode, alternateText: data.memberCode },
    textModulesData: [{ id: 'next_reward', header: 'Próxima recompensa', body: rewardText(data) }],
    hexBackgroundColor: brandColor(data.business.primaryColor),
    ...(heroImage ? { heroImage } : {}),
  }
}

export function buildLoyaltyObject(issuerId: string, data: PassData, stampBase?: string | null) {
  return {
    id: objectIdFor(issuerId, data.objectId),
    classId: classIdFor(issuerId, data.businessId),
    ...loyaltyObjectFields(data, stampBase),
  }
}

/**
 * PATCH del sync. Con notifyPreference = "notifyOnUpdate", Google avisa en la pantalla
 * del teléfono cuando cambia loyaltyPoints.balance (hasta 3 avisos por pase cada 24 h).
 */
export function buildObjectPatch(data: PassData, notify: boolean, stampBase?: string | null) {
  return {
    ...loyaltyObjectFields(data, stampBase),
    ...(notify && data.active ? { notifyPreference: 'notifyOnUpdate' } : {}),
  }
}

export function buildMessage(id: string, header: string, body: string) {
  return {
    message: {
      id,
      header: header.slice(0, 100),
      body: body.slice(0, 500),
      messageType: 'TEXT_AND_NOTIFY',
    },
  }
}

/** Claims del JWT "Guardar en Google Wallet". El objeto ya existe: va solo su id. */
export function saveJwtClaims(
  clientEmail: string,
  issuerId: string,
  data: PassData,
  origins: string[],
  nowSeconds: number,
) {
  return {
    iss: clientEmail,
    aud: 'google',
    typ: 'savetowallet',
    iat: nowSeconds,
    origins,
    payload: {
      loyaltyObjects: [
        {
          id: objectIdFor(issuerId, data.objectId),
          classId: classIdFor(issuerId, data.businessId),
        },
      ],
    },
  }
}

/** Claims para pedir el token OAuth de la cuenta de servicio. */
export function oauthClaims(clientEmail: string, nowSeconds: number) {
  return {
    iss: clientEmail,
    scope: WALLET_SCOPE,
    aud: 'https://oauth2.googleapis.com/token',
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  }
}
